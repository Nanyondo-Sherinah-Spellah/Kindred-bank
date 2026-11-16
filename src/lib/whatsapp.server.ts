// Server-only WhatsApp channel: verified webhook inbox processing, AI replies through
// the shared engine, delivery status reconciliation, and central interaction logging.
import { caseRef, classify, decide, type KnowledgeRow } from "./engine.server";
import { INTERNAL_KB } from "./kindred-kb.server";
import type { Lang } from "./lang";

export const WHATSAPP_NUMBER_DISPLAY = "+234 700 555 0188";
export const WHATSAPP_NUMBER_DIGITS = "2347005550188";
const GATEWAY_URL = "https://connector-gateway.lovable.dev/whatsapp";
const STATUS_RANK: Record<string, number> = { accepted: 0, sent: 1, delivered: 2, read: 3, failed: 4 };

type SB = any;

async function admin(): Promise<SB> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export function whatsappConfigured() {
  return Boolean(process.env["LOVABLE_API_KEY"] && process.env["WHATSAPP_API_KEY"]);
}

export async function sendWhatsAppText(to: string, body: string): Promise<string> {
  const lovable = process.env["LOVABLE_API_KEY"];
  const wa = process.env["WHATSAPP_API_KEY"];
  if (!lovable) throw new Error("LOVABLE_API_KEY is not configured");
  if (!wa) throw new Error("WHATSAPP_API_KEY is not configured");
  const res = await fetch(`${GATEWAY_URL}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${lovable}`, "X-Connection-Api-Key": wa, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to: to.replace(/\D/g, ""), type: "text", text: { body } }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`WhatsApp send failed (${res.status}): ${text.slice(0, 300)}`);
  const id = (JSON.parse(text) as { messages?: { id: string }[] }).messages?.[0]?.id;
  if (!id) throw new Error(`WhatsApp send returned no message id: ${text.slice(0, 200)}`);
  return id;
}

async function must<T>(p: PromiseLike<{ data: T; error: { message: string } | null }>, what: string): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(`${what}: ${error.message}`);
  return data;
}

async function applyStatus(sb: SB, st: { id: string; status: string; timestamp?: string; errors?: unknown[] }): Promise<boolean> {
  const row = await must<{ id: string; status: string } | null>(
    sb.from("whatsapp_messages").select("id, status").eq("wa_message_id", st.id).eq("direction", "outgoing").maybeSingle(),
    "status lookup",
  );
  if (!row) return false; // outbound row not saved yet — keep the event pending
  const at = st.timestamp ? new Date(Number(st.timestamp) * 1000).toISOString() : null;
  const newer = (STATUS_RANK[st.status] ?? 0) > (STATUS_RANK[row.status] ?? 0);
  if (newer) {
    await must(sb.from("whatsapp_messages").update({
      status: st.status, status_at: at,
      error: st.errors?.length ? JSON.stringify(st.errors).slice(0, 1000) : null,
    }).eq("id", row.id), "status update");
  }
  return true;
}

async function handleInbound(sb: SB, msg: any, contactName: string | null) {
  const waId = String(msg.id);
  const phone = String(msg.from);
  const text: string =
    msg.type === "text" ? msg.text?.body ?? "" :
    msg.type === "button" ? msg.button?.text ?? "" :
    msg.type === "interactive" ? msg.interactive?.button_reply?.title ?? msg.interactive?.list_reply?.title ?? "" : "";

  let inbound = await must<any>(sb.from("whatsapp_messages").select("*").eq("wa_message_id", waId).eq("direction", "incoming").maybeSingle(), "inbound lookup");
  const existingReply = await must<any>(sb.from("whatsapp_messages").select("id, status").eq("reply_to", waId).eq("direction", "outgoing").maybeSingle(), "reply lookup");
  if (existingReply && existingReply.status !== "failed") return; // already answered

  const prev = await must<any[]>(sb.from("whatsapp_messages").select("language").eq("phone", phone).eq("direction", "incoming").not("language", "is", null).order("created_at", { ascending: false }).limit(1), "language lookup");
  const prevLang = (prev[0]?.language as Lang | undefined) ?? undefined;

  const { data: kbRows, error } = await sb.from("knowledge").select("id, topic, keywords, approved_answer, category");
  if (error) throw new Error(`knowledge: ${error.message}`);
  const kb: KnowledgeRow[] = [...((kbRows ?? []) as KnowledgeRow[]), ...INTERNAL_KB];
  const ref = (inbound?.case_reference as string) ?? caseRef();

  const body = text.trim() || "[non-text message]";
  const c = text.trim()
    ? await classify(text, kb, prevLang)
    : { intent: "unknown" as const, knowledgeId: null, summary: `Customer sent a ${msg.type} message`, engine: "ai" as const, language: prevLang ?? ("en" as Lang) };
  const d = decide(c, kb, "whatsapp", { bank: "Kindred Bank", secure: "our secure customer support line or any Kindred Bank branch", ref });

  if (!inbound) {
    inbound = await must(sb.from("whatsapp_messages").insert({
      direction: "incoming", phone, body, language: d.language, intent: c.intent, wa_message_id: waId,
      case_reference: ref, source: "whatsapp", status: "received",
    }).select("*").single(), "inbound insert");
    await must(sb.from("interaction_logs").insert({
      channel: "whatsapp", direction: "incoming", customer_email: `whatsapp:+${phone}${contactName ? ` (${contactName})` : ""}`,
      interaction_summary: c.summary, result: `intent:${c.intent}`, case_reference: ref,
    }), "log incoming");
    if (d.escalate) {
      await must(sb.from("escalations").insert({
        customer_email: `whatsapp:+${phone}`, channel: "whatsapp", issue_category: d.escalate.category,
        description: `${d.escalate.reason}. Customer wrote: ${body.slice(0, 1000)}`, priority: d.escalate.priority,
        case_reference: ref, conversation_summary: c.summary,
      }), "escalation");
    }
  }

  let status = "accepted";
  let outId: string | null = null;
  let err: string | null = null;
  try {
    outId = await sendWhatsAppText(phone, d.response);
  } catch (e) {
    status = "failed";
    err = e instanceof Error ? e.message : String(e);
  }
  if (existingReply) {
    await must(sb.from("whatsapp_messages").update({ status, wa_message_id: outId, error: err, body: d.response }).eq("id", existingReply.id), "reply update");
  } else {
    await must(sb.from("whatsapp_messages").insert({
      direction: "outgoing", phone, body: d.response, language: d.language, intent: c.intent, wa_message_id: outId,
      reply_to: waId, case_reference: ref, source: "whatsapp", status, error: err,
    }), "reply insert");
  }
  await must(sb.from("interaction_logs").insert({
    channel: "whatsapp", direction: "outgoing", customer_email: `whatsapp:+${phone}`,
    interaction_summary: `${status === "failed" ? "Reply failed" : "Reply sent"}: ${d.response.slice(0, 140)}`,
    result: status === "failed" ? "send_failed" : d.action, case_reference: ref,
  }), "log outgoing");
  if (status === "failed") throw new Error(err ?? "send failed");
}

/** Processes one stored event. Returns true when complete, false when it must wait. */
async function processEvent(sb: SB, ev: { id: string; event: string; payload: any }): Promise<boolean> {
  const value = ev.payload?.entry?.[0]?.changes?.[0]?.value ?? {};
  if (ev.event === "whatsapp.message") {
    const name = value.contacts?.[0]?.profile?.name ?? null;
    for (const m of value.messages ?? []) await handleInbound(sb, m, name);
    return true;
  }
  if (ev.event === "whatsapp.status") {
    let all = true;
    for (const st of value.statuses ?? []) if (!(await applyStatus(sb, st))) all = false;
    return all;
  }
  return true; // stored for review; nothing to process
}

async function runEvent(sb: SB, ev: { id: string; event: string; payload: any; attempts: number }) {
  try {
    const done = await processEvent(sb, ev);
    await must(sb.from("whatsapp_webhook_events").update(
      done ? { processed_at: new Date().toISOString(), processing_error: null, attempts: ev.attempts + 1 }
           : { processing_error: "waiting for outbound message record", attempts: ev.attempts + 1 },
    ).eq("id", ev.id), "event update");
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await sb.from("whatsapp_webhook_events").update({ processing_error: msg.slice(0, 1000), attempts: ev.attempts + 1 }).eq("id", ev.id);
    return { ok: false, error: msg };
  }
}

export async function handleWebhookDelivery(deliveryId: string, event: string, payload: unknown) {
  const sb = await admin();
  const { error: insErr } = await sb.from("whatsapp_webhook_events")
    .upsert({ delivery_id: deliveryId, event, payload }, { onConflict: "delivery_id", ignoreDuplicates: true });
  if (insErr) throw new Error(`inbox write failed: ${insErr.message}`);
  const ev = await must<any>(sb.from("whatsapp_webhook_events").select("*").eq("delivery_id", deliveryId).single(), "inbox read");
  const result = ev.processed_at ? { ok: true } : await runEvent(sb, ev);

  // Recovery: retry a few older unfinished events, least-attempted first so blocked rows can't starve others.
  const pending = await must<any[]>(sb.from("whatsapp_webhook_events").select("*").is("processed_at", null)
    .neq("delivery_id", deliveryId).lt("attempts", 20).order("attempts", { ascending: true }).order("received_at", { ascending: true }).limit(3), "pending read");
  for (const p of pending) await runEvent(sb, p);
  return result;
}
