import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { upsellLine } from "./customer-conversation";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { caseRef, classify, decide, type KnowledgeRow } from "./engine.server";
import { INTERNAL_KB } from "./kindred-kb.server";
import { bankTimeOfDay, PHRASES, type Lang } from "./lang";
import { smartVoiceQuestion, trainingClassification, voiceKnowledge, voiceTrainingDecision, type VoiceTraining } from "./voice-training";
import { hashVoiceToken, validVoiceCapability, publicVoiceDecision, publicVoiceLanguage, isBalanceRequest, parseBalanceCredentials, maskDigits } from "./public-voice-policy";
import { emailTrainingReply, matchEmailTraining } from "./email-training";
import { isOpeningRequest } from "./account-opening";
import { translateBankReply, translateVoiceReply, removeEnglishFallbackNote } from "./conversation-language.server";
import type { VoiceReplyEvent } from "./voice-reply-stream";
import { localizedQuestions } from "./suggested-questions.server";
import { parseCustomerCredentials } from "./customer-conversation";
import { recognizedCustomer, rememberCustomer, resolveConversation } from "./customer-conversation.server";

type Ctx = { supabase: any; userId: string | null };

async function loadBase(ctx: Ctx) {
  const [{ data: kb, error: e1 }, { data: settings }, { data: training, error: trainingError }] = await Promise.all([
    ctx.supabase.from("knowledge").select("id, topic, keywords, approved_answer, category"),
    ctx.supabase.from("app_settings").select("*").eq("id", 1).maybeSingle(),
    ctx.supabase.from("voice_training_questions").select("id, question, language, approved_answer, topic, keywords, intent, sort_order").order("sort_order"),
  ]);
  if (e1) throw new Error(`Could not load knowledge base: ${e1.message}`);
  if (trainingError) throw new Error("Could not load approved voice questions");
  const voiceTraining = (training ?? []) as VoiceTraining[];
  return {
    kb: [...voiceKnowledge(voiceTraining).filter((row) => row.topic !== "Fixed deposit example"), ...((kb ?? []) as KnowledgeRow[]), ...INTERNAL_KB],
    voiceTraining,
    bank: "Kindred Bank",
    secure: (settings?.secure_channel_text as string) ?? "our secure private support channel",
    settings: settings ?? {},
  };
}

async function log(ctx: Ctx, row: {
  channel: "email" | "social" | "voice" | "whatsapp";
  direction: "incoming" | "outgoing";
  customer_email: string | null;
  interaction_summary: string;
  result: string;
  case_reference: string;
}) {
  const { error } = await ctx.supabase.from("interaction_logs").insert({ ...row, created_by: ctx.userId });
  if (error) throw new Error(`Logging failed: ${error.message}`);
}

async function escalate(ctx: Ctx, row: {
  customer_email: string | null; channel: string; issue_category: string; description: string;
  priority: string; case_reference: string; conversation_summary: string;
}) {
  const { data, error } = await ctx.supabase.from("escalations").insert(row).select("id").single();
  if (error) throw new Error(`Escalation failed: ${error.message}`);
  return data.id as string;
}

// ---------- Integrations ----------
export function integrationFlags() {
  const has = (k: string) => Boolean(process.env[k]);
  return {
    gmail: has("GOOGLE_MAIL_API_KEY") && has("LOVABLE_API_KEY"),
    outlook: has("MICROSOFT_OUTLOOK_API_KEY") && has("LOVABLE_API_KEY"),
    meta: has("META_PAGE_ACCESS_TOKEN"),
    x: has("X_ACCESS_TOKEN"),
    whatsapp: has("WHATSAPP_API_KEY") && has("LOVABLE_API_KEY"),
    voiceProvider: has("TWILIO_API_KEY") || has("TWILIO_AUTH_TOKEN"),
    ai: has("LOVABLE_API_KEY"),
  };
}

export const getIntegrationStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => integrationFlags());

// ---------- Email ----------
const emailInput = z.object({
  sender: z.string().trim().email().max(255),
  subject: z.string().trim().max(300),
  body: z.string().trim().min(1).max(5000),
  auto: z.boolean(),
});

type Thread = { threadId: string; messageId?: string };
export async function sendViaGmail(to: string, subject: string, body: string, thread?: Thread) {
  const b64 = (s: string) => btoa(Array.from(new TextEncoder().encode(s), (b) => String.fromCharCode(b)).join(""));
  const header = (v: string) => (/^[\x00-\x7F]*$/.test(v) ? v : `=?UTF-8?B?${b64(v)}?=`);
  const reply = thread?.messageId ? [`In-Reply-To: ${thread.messageId}`, `References: ${thread.messageId}`] : [];
  const raw = b64([`To: ${to}`, `Subject: ${header(subject)}`, ...reply, "MIME-Version: 1.0", 'Content-Type: text/plain; charset="UTF-8"', "", body].join("\r\n"))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const res = await fetch("https://connector-gateway.lovable.dev/google_mail/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env["LOVABLE_API_KEY"]}`,
      "X-Connection-Api-Key": process.env["GOOGLE_MAIL_API_KEY"]!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(thread ? { raw, threadId: thread.threadId } : { raw }),
  });
  if (!res.ok) throw new Error(`Gmail send failed [${res.status}]: ${(await res.text()).slice(0, 300)}`);
}

async function deliverEmail(ctx: Ctx, id: string, to: string, subject: string, body: string, ref: string, thread?: Thread) {
  const flags = integrationFlags();
  let status = "approved_not_sent";
  let note = "Approved. Not delivered: no email service is connected (demo mode).";
  if (flags.gmail) {
    try {
      await sendViaGmail(to, subject.startsWith("Re:") ? subject : `Re: ${subject || "Your enquiry"}`, body, thread);
      status = "sent";
      note = "Sent via Gmail.";
    } catch (e) {
      status = "send_failed";
      note = e instanceof Error ? e.message : String(e);
    }
  }
  await ctx.supabase.from("email_messages").update({ final_response: body, status, delivery_note: note }).eq("id", id);
  await log(ctx, {
    channel: "email", direction: "outgoing", customer_email: to,
    interaction_summary: `Reply ${status === "sent" ? "sent" : "prepared"}: ${body.slice(0, 140)}`,
    result: status, case_reference: ref,
  });
  return { status, note };
}

export const processEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => emailInput.parse(d))
  .handler(async ({ data, context }) => runIncomingEmail(context as unknown as Ctx, data));

export async function runIncomingEmail(ctx: Ctx, data: z.infer<typeof emailInput>, gmail?: { id: string } & Thread) {
    const base = await loadBase(ctx);
    const ref = caseRef();
    const text = `${data.subject}\n${data.body}`;
    const opening = isOpeningRequest(text);
    const trained = matchEmailTraining(text);
    const c = await classify(text, base.kb);
    if (trained) { c.knowledgeId = trained.id; c.summary = c.summary || trained.topic; }
    const d = opening
      ? { action: "answer" as const, response: "You can open an account without speaking to a person. Complete the secure application at https://kindred-bank-concierge.lovable.app/open-account?channel=email and verify your email there. A test account number is assigned immediately after verification and appears in the admin records. This uses an imaginary banking provider, not a real bank account. Use test identity details and sample documents only. Do not email BVN, NIN, PINs or identity documents.", language: "en" as Lang, escalate: null }
      : trained
      ? { action: "answer" as const, response: emailTrainingReply(trained, base.bank, ref), language: "en" as Lang, escalate: trained.escalate ?? null }
      : decide(c, base.kb, "email", { bank: base.bank, secure: base.secure, ref });

    await log(ctx, { channel: "email", direction: "incoming", customer_email: data.sender,
      interaction_summary: `${data.subject ? `"${data.subject}" — ` : ""}${c.summary}`, result: `intent:${c.intent}`, case_reference: ref });

    let escalationId: string | null = null;
    if (d.escalate) {
      escalationId = await escalate(ctx, { customer_email: data.sender, channel: "email", issue_category: d.escalate.category,
        description: `${d.escalate.reason}. Customer wrote: ${data.body.slice(0, 1000)}`, priority: d.escalate.priority,
        case_reference: ref, conversation_summary: c.summary });
    }

    let knowledgeRef: string | null = null;
    if (c.knowledgeId && /^[0-9a-f-]{36}$/i.test(c.knowledgeId)) {
      const { data: k } = await ctx.supabase.from("knowledge").select("id").eq("id", c.knowledgeId).maybeSingle();
      knowledgeRef = k ? c.knowledgeId : null;
    }
    const { data: row, error } = await ctx.supabase.from("email_messages").insert({
      sender: data.sender, subject: data.subject, body: data.body, intent: c.intent,
      knowledge_id: knowledgeRef,
      draft_response: d.response, status: d.escalate && d.action === "escalate" ? "escalated" : "pending_review",
      case_reference: ref, escalation_id: escalationId, source: gmail ? "gmail" : "demo", gmail_message_id: gmail?.id ?? null,
      delivery_note: c.note ?? null,
    }).select("*").single();
    if (error) throw new Error(error.message);

    let delivery: { status: string; note: string } | null = null;
    if (data.auto && d.action === "answer") {
      delivery = await deliverEmail(ctx, row.id, data.sender, data.subject, d.response, ref, gmail);
    }
    return { id: row.id as string, caseReference: ref, classification: c, decision: d, delivery };
}

export const approveEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), body: z.string().trim().min(1).max(8000) }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const { data: msg, error } = await ctx.supabase.from("email_messages").select("*").eq("id", data.id).single();
    if (error) throw new Error(error.message);
    return deliverEmail(ctx, msg.id, msg.sender, msg.subject, data.body, msg.case_reference);
  });

export const escalateEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), reason: z.string().trim().max(500) }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const { data: msg, error } = await ctx.supabase.from("email_messages").select("*").eq("id", data.id).single();
    if (error) throw new Error(error.message);
    if (msg.escalation_id) return { escalationId: msg.escalation_id as string };
    const id = await escalate(ctx, { customer_email: msg.sender, channel: "email", issue_category: "Manual escalation",
      description: `${data.reason || "Escalated by staff"}. Customer wrote: ${String(msg.body).slice(0, 1000)}`,
      priority: "medium", case_reference: msg.case_reference, conversation_summary: msg.subject });
    await ctx.supabase.from("email_messages").update({ escalation_id: id, status: "escalated" }).eq("id", msg.id);
    await log(ctx, { channel: "email", direction: "outgoing", customer_email: msg.sender, interaction_summary: "Escalated to human support by staff", result: "escalated", case_reference: msg.case_reference });
    return { escalationId: id };
  });

// ---------- Social ----------
const socialInput = z.object({
  platform: z.enum(["facebook", "instagram", "x"]),
  messageType: z.enum(["comment", "direct_message"]),
  author: z.string().trim().min(1).max(100),
  body: z.string().trim().min(1).max(2000),
});

export const processSocial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => socialInput.parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const base = await loadBase(ctx);
    const ref = caseRef();
    const c = await classify(data.body, base.kb);
    const d = decide(c, base.kb, "social", { bank: base.bank, secure: base.secure, ref });
    const who = `${data.platform}:${data.author}`;

    await log(ctx, { channel: "social", direction: "incoming", customer_email: who,
      interaction_summary: `${data.messageType === "comment" ? "Public comment" : "Direct message"} on ${data.platform}: ${c.summary}`,
      result: `intent:${c.intent}`, case_reference: ref });

    let escalationId: string | null = null;
    if (d.escalate) {
      escalationId = await escalate(ctx, { customer_email: who, channel: "social", issue_category: d.escalate.category,
        description: `${d.escalate.reason}. Message: ${data.body.slice(0, 1000)}`, priority: d.escalate.priority,
        case_reference: ref, conversation_summary: c.summary });
    }
    const connected = data.platform === "x" ? integrationFlags().x : integrationFlags().meta;
    const action = d.action === "redirect_private" ? "private_redirect" : d.action === "escalate" ? "escalated" : "public_reply";
    const note = connected
      ? "Credentials present; automatic posting is not enabled in this build — copy the reply to the platform."
      : `Not posted: ${data.platform} is not connected (demo mode).`;

    await ctx.supabase.from("social_messages").insert({
      platform: data.platform, message_type: data.messageType, author_handle: data.author, body: data.body,
      intent: c.intent, action, response: d.response, status: "ready_not_posted", delivery_note: note,
      case_reference: ref, escalation_id: escalationId,
    });
    await log(ctx, { channel: "social", direction: "outgoing", customer_email: who,
      interaction_summary: `${action.replace("_", " ")}: ${d.response.slice(0, 140)}`, result: action, case_reference: ref });

    return { caseReference: ref, classification: c, decision: d, action, note };
  });

// ---------- Voice ----------
type Turn = { role: "assistant" | "customer"; text: string; at: string; lang?: Lang };

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export const getVoiceSuggestions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("voice_training_questions")
      .select("id, question, language, category").in("language", ["en", "pcm"]).order("sort_order");
    if (error) throw new Error("Could not load suggested questions");
    return data;
  });

export const voiceStart = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ language: z.enum(["en", "pcm"]) }).parse(d))
  .handler(async ({ data: input, context }) => {
    const ctx = context as unknown as Ctx;
    const base = await loadBase(ctx);
    const recording = Boolean((base.settings as { voice_recording_enabled?: boolean }).voice_recording_enabled);
    const tod = bankTimeOfDay();
    const greeting = `${PHRASES[input.language].tod[tod]}! ${PHRASES[input.language].welcome}${recording ? " This conversation is saved for quality and training purposes." : ""}`;
    const ref = caseRef();
    const sb = await admin();
    const transcript: Turn[] = [{ role: "assistant", text: greeting, at: new Date().toISOString(), lang: input.language }];
    const { data, error } = await sb.from("voice_sessions").insert({ case_reference: ref, transcript }).select("id").single();
    if (error) throw new Error(error.message);
    await log(ctx, { channel: "voice", direction: "outgoing", customer_email: null, interaction_summary: "Voice session started; greeting delivered", result: "greeting", case_reference: ref });
    return { sessionId: data.id as string, caseReference: ref, reply: greeting };
  });

const fmtDate = (d: string) => new Date(d + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

export const voiceTurn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ sessionId: z.string().uuid(), text: z.string().trim().min(1).max(1000) }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const sb = await admin();
    const { data: s, error } = await sb.from("voice_sessions").select("*").eq("id", data.sessionId).single();
    if (error || !s) throw new Error("Voice session not found");
    if (s.status !== "active") throw new Error("This voice session has ended. Start a new one.");
    const ref = s.case_reference as string;
    const transcript = (s.transcript as Turn[]) ?? [];
    const prevLang = [...transcript].reverse().find((t) => t.lang)?.lang;
    let lang: Lang = prevLang ?? "en";
    transcript.push({ role: "customer", text: data.text, at: new Date().toISOString() });

    let reply = "";
    let pending: string | null = s.pending_action;
    let attempts = s.verification_attempts as number;
    let verified: string | null = s.verified_customer_email;
    let status = "active";
    let escalated = false;
    const digits = data.text.replace(/[^0-9]/g, "");

    await log(ctx, { channel: "voice", direction: "incoming", customer_email: verified, interaction_summary: pending === "verify_repayment" && digits ? "Customer provided a verification code" : `Customer said: ${data.text.slice(0, 140)}`, result: "received", case_reference: ref });

    if (pending === "verify_repayment" && digits.length >= 4) {
      const { data: cust } = await sb.from("customers").select("email, next_repayment_date, repayment_amount, loan_status").eq("demo_verification_code", digits.slice(0, 8)).maybeSingle();
      if (cust) {
        verified = cust.email;
        pending = null;
        attempts = 0;
        const amt = Number(cust.repayment_amount).toLocaleString("en-US");
        reply = cust.next_repayment_date
          ? `Thank you, you are verified. Your next repayment is due on ${fmtDate(cust.next_repayment_date)}. The demonstration repayment amount is UGX ${amt}. Your loan status is ${cust.loan_status}. Is there anything else I can help with?`
          : `Thank you, you are verified. There is no upcoming repayment on record. Your loan status is ${cust.loan_status}.`;
        await log(ctx, { channel: "voice", direction: "outgoing", customer_email: cust.email, interaction_summary: "Verified demo customer; repayment information provided", result: "verified_resolved", case_reference: ref });
      } else {
        attempts += 1;
        if (attempts >= 3) {
          pending = null;
          escalated = true;
          await escalate(ctx, { customer_email: null, channel: "voice", issue_category: "Verification failed", description: "Caller failed demo verification 3 times while requesting repayment information.", priority: "high", case_reference: ref, conversation_summary: "Repeated failed verification" });
          reply = `I'm sorry, I was unable to verify your identity. For your security I have passed this to a member of our support team. Your case reference is ${ref}.`;
          await log(ctx, { channel: "voice", direction: "outgoing", customer_email: null, interaction_summary: "Verification failed 3 times; escalated", result: "escalated", case_reference: ref });
        } else {
          reply = `I'm sorry, that code did not match our records. Please try again. You have ${3 - attempts} attempt${3 - attempts === 1 ? "" : "s"} remaining.`;
          await log(ctx, { channel: "voice", direction: "outgoing", customer_email: null, interaction_summary: "Verification code did not match", result: "verification_failed", case_reference: ref });
        }
      }
    } else {
      const base = await loadBase(ctx);
      const exact = smartVoiceQuestion(data.text, base.voiceTraining, lang);
      const c = exact ? trainingClassification(exact, lang) : await classify(data.text, base.kb, prevLang);
      // The explicit session preference takes precedence over automatic detection.
      c.language = lang;
      const trained = voiceTrainingDecision(data.text, c, base.voiceTraining, lang, ref);
      const balanceRequest = /\b(balance|statement)\b/i.test(data.text);
      const d = trained ?? (balanceRequest && c.intent === "personal_account"
        ? { action: "escalate" as const, language: lang, response: `${lang === "pcm" ? "Sorry, account balance no dey available for this demonstration. Use the secure Kindred app or contact our staff. " : "Account balances are not available in this demonstration. Please use the secure Kindred app or contact our support team. "}Your case reference is ${ref}.`, escalate: { category: "Personal account enquiry", priority: "low" as const, reason: "Balance or statement access is not available in the demonstration" } }
        : decide(c, base.kb.filter((row) => row.topic !== "Fixed deposit example"), "voice", { bank: base.bank, secure: base.secure, ref }));
      lang = d.language;
      if (d.action === "verify") {
        if (verified) {
          const { data: cust } = await sb.from("customers").select("next_repayment_date, repayment_amount, loan_status").eq("email", verified).single();
          if (!cust) throw new Error("Verified customer record could not be found");
          reply = cust.next_repayment_date ? `Your next repayment is due on ${fmtDate(cust.next_repayment_date)}. The demonstration repayment amount is UGX ${Number(cust.repayment_amount).toLocaleString("en-US")}.` : "There is no upcoming repayment on record.";
        } else {
          pending = "verify_repayment";
          reply = d.response;
        }
      } else {
        pending = null;
        reply = d.response;
        if (d.escalate) {
          escalated = true;
          await escalate(ctx, { customer_email: verified, channel: "voice", issue_category: d.escalate.category, description: `${d.escalate.reason}. Caller said: ${data.text.slice(0, 1000)}`, priority: d.escalate.priority, case_reference: ref, conversation_summary: c.summary });
        }
      }
      await log(ctx, { channel: "voice", direction: "outgoing", customer_email: verified, interaction_summary: `${c.summary} → ${reply.slice(0, 120)}`, result: escalated ? "escalated" : d.action, case_reference: ref });
    }

    transcript.push({ role: "assistant", text: reply, at: new Date().toISOString(), lang });
    const { error: saveError } = await sb.from("voice_sessions").update({ transcript, pending_action: pending, verification_attempts: attempts, verified_customer_email: verified, status }).eq("id", data.sessionId);
    if (saveError) throw new Error("Could not save the voice conversation");
    return { reply, language: lang, awaitingVerification: pending === "verify_repayment", verified: Boolean(verified), escalated };
  });

export const voiceEscalate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ sessionId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const sb = await admin();
    const { data: s } = await sb.from("voice_sessions").select("*").eq("id", data.sessionId).single();
    if (!s) throw new Error("Session not found");
    const t = ((s.transcript as Turn[]) ?? []).map((x) => `${x.role}: ${x.text}`).join("\n").slice(0, 2000);
    await escalate(ctx, { customer_email: s.verified_customer_email, channel: "voice", issue_category: "Caller requested human", description: "Escalated from the voice assistant.", priority: "medium", case_reference: s.case_reference, conversation_summary: t });
    const reply = `I'm transferring your request to a member of our support team. Your case reference is ${s.case_reference}.`;
    const transcript = [...((s.transcript as Turn[]) ?? []), { role: "assistant", text: reply, at: new Date().toISOString() }];
    await sb.from("voice_sessions").update({ transcript, status: "escalated", pending_action: null }).eq("id", s.id);
    await log(ctx, { channel: "voice", direction: "outgoing", customer_email: s.verified_customer_email, interaction_summary: "Voice session escalated to human support", result: "escalated", case_reference: s.case_reference });
    return { reply };
  });

export const voiceEnd = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ sessionId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const sb = await admin();
    await sb.from("voice_sessions").update({ status: "ended", pending_action: null }).eq("id", data.sessionId).eq("status", "active");
    return { ok: true };
  });

// ---------- WhatsApp (demo chat; same engine as the live webhook) ----------
// Public voice endpoints return only the visitor's own reply, never staff history or customer records.
const publicVoiceInput = z.object({ sessionId: z.string().uuid(), token: z.string().regex(/^[a-f0-9]{64}$/) });

async function publicVoiceSession(input: z.infer<typeof publicVoiceInput>) {
  const sb = await admin();
  const { data: access, error } = await sb.from("public_voice_access").select("token_hash, expires_at").eq("session_id", input.sessionId).maybeSingle();
  if (error || !validVoiceCapability(access, await hashVoiceToken(input.token))) throw new Error("This voice session is unavailable or has expired. Start a new conversation.");
  const { data: session } = await sb.from("voice_sessions").select("id, case_reference, transcript, status, pending_action, verification_attempts, verified_customer_email, recognized_customer_id, resolution_state, offer_shown").eq("id", input.sessionId).single();
  if (!session || session.status !== "active") throw new Error("This conversation has ended. Start a new one.");
  return { sb, session };
}

export const publicVoiceStart = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ language: z.enum(["en", "pcm", "ha", "ig", "yo"]), existing: z.boolean().default(false), mode: z.enum(["voice", "chat"]).default("voice") }).parse(d))
  .handler(async ({ data }) => {
    const sb = await admin();
    const ref = caseRef();
    const customer = data.existing ? await recognizedCustomer(sb) : null;
    const firstName = customer?.full_name.split(" ")[0];
    const originalReply = firstName
      ? `Welcome back, ${firstName}! Please verify your account number or registered phone number and your 4-digit verification code before accessing personal information. Never share your PIN, password or OTP.`
      : data.existing
        ? "Welcome to Kindred Bank! Please enter your account number or registered phone number and your 4-digit verification code to sign in to this conversation. Never share your PIN, password or OTP."
        : `${PHRASES[data.language].tod[bankTimeOfDay()]}! ${PHRASES[data.language].welcome}`;
    const reply = await translateBankReply(originalReply, data.language);
    const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) => byte.toString(16).padStart(2, "0")).join("");
    const { data: session, error } = await sb.from("voice_sessions").insert({ case_reference: ref, recognized_customer_id: customer?.id ?? null, pending_action: data.existing ? "verify_customer" : null, transcript: [{ role: "assistant", text: reply, at: new Date().toISOString(), lang: data.language }] }).select("id").single();
    if (error || !session) throw new Error("Could not start voice support. Please try again.");
    const { error: accessError } = await sb.from("public_voice_access").insert({ session_id: session.id, token_hash: await hashVoiceToken(token), expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString() });
    if (accessError) throw new Error("Could not secure your voice session.");
    await escalate({ supabase: sb, userId: null }, { customer_email: null, channel: "voice", issue_category: data.mode === "chat" ? "Chatbot enquiry" : "Voice enquiry", description: "Automated customer support conversation", priority: "low", case_reference: ref, conversation_summary: "Conversation started; resolution pending." });
    await log({ supabase: sb, userId: null }, { channel: "voice", direction: "outgoing", customer_email: null, interaction_summary: "Public voice session started", result: "greeting", case_reference: ref });
    const { data: questions, error: questionError } = await sb.from("voice_training_questions").select("id, question, language, category").in("language", ["en", "pcm"]).order("sort_order");
    if (questionError) throw new Error("Could not load suggested questions.");
    return { sessionId: session.id, token, caseReference: ref, reply, questions: await localizedQuestions(questions ?? [], data.language) };
  });

export const publicVoiceTurn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => publicVoiceInput.extend({ text: z.string().trim().min(1).max(1000), remember: z.boolean().default(false) }).parse(d))
  .handler(async ({ data }) => processPublicVoiceTurn(data));

export const publicVoiceReplyStream = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => publicVoiceInput.extend({ text: z.string().trim().min(1).max(1000).refine((text) => !parseCustomerCredentials(text) && !parseBalanceCredentials(text), "Use the verification form for account details.") }).parse(d))
  .handler(async ({ data }) => {
    await publicVoiceSession(data);
    const encoder = new TextEncoder();
    let cancelled = false;
    return new Response(new ReadableStream<Uint8Array>({
      async start(controller) {
        const emit = (event: VoiceReplyEvent) => { if (!cancelled) controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`)); };
        try {
          const result = await processPublicVoiceTurn({ ...data, remember: false }, (text) => emit({ type: "chunk", text }));
          emit({ type: "done", ...result });
        } catch { emit({ type: "error", message: "The rest of this reply could not be completed. Please try again." }); }
        finally { if (!cancelled) controller.close(); }
      },
      cancel() { cancelled = true; },
    }), { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" } });
  });

async function processPublicVoiceTurn(data: z.infer<typeof publicVoiceInput> & { text: string; remember: boolean }, emit?: (text: string) => void) {
    const { sb, session } = await publicVoiceSession(data);
    const ctx: Ctx = { supabase: sb, userId: null };
    const transcript = (session.transcript as Turn[]) ?? [];
    const language = publicVoiceLanguage(transcript);
    const ref = session.case_reference;
    const result = await (async () => {
    const identity = parseCustomerCredentials(data.text) ?? (() => { const balance = parseBalanceCredentials(data.text); return balance ? { identity: balance.account, code: balance.code } : null; })();
    if (identity && session.pending_action !== "balance_locked") {
      const { data: rawResult, error: verifyError } = await sb.rpc("verify_voice_customer", { p_session: session.id, p_identity: identity.identity.replace(/\D/g, ""), p_code: identity.code });
      const result = z.object({ error: z.string().optional(), remaining: z.number().optional(), customer_id: z.string().uuid().optional(), first_name: z.string().optional() }).parse(rawResult);
      if (verifyError || (!result.error && !result.customer_id)) throw new Error("Could not verify your details.");
      let reply: string;
      if (result.error) {
        reply = result.error === "locked"
          ? `For your security, verification is locked after 3 unsuccessful attempts. Our support team will help you — your case reference is ${ref}.`
          : `Those details don't match our records. Please try again with your account number or registered phone number and 4-digit verification code. (${result.remaining} ${result.remaining === 1 ? "attempt" : "attempts"} left.)`;
      } else {
        if (!result.customer_id) throw new Error("Could not verify your details.");
        await rememberCustomer(sb, result.customer_id, data.remember);
        session.verified_customer_email = null;
        const { data: customer } = await sb.from("customers").select("email,account_balance").eq("id", result.customer_id).single();
        if (!customer) throw new Error("Could not load your verified account.");
        session.verified_customer_email = customer.email;
        const wantsBalance = isBalanceRequest(data.text) || session.pending_action === "verify_balance";
        reply = `Welcome, ${result.first_name}! You are verified. ${wantsBalance ? `Your available balance is ₦${Number(customer?.account_balance ?? 0).toLocaleString("en-NG", { minimumFractionDigits: 2 })}.` : "How can I help you today? You can ask about your balance or our banking products."}`;
        if (wantsBalance) await sb.from("voice_sessions").update({ resolution_state: session.resolution_state === "escalated" ? "escalated" : "answered" }).eq("id", session.id);
      }
      const now = new Date().toISOString();
      const { error: saveError } = await sb.from("voice_sessions").update({ transcript: [...transcript, { role: "customer", text: maskDigits(data.text), at: now, lang: language }, { role: "assistant", text: reply, at: now, lang: language }] }).eq("id", session.id);
      if (saveError) throw new Error("Could not save verification.");
      await log(ctx, { channel: "voice", direction: "outgoing", customer_email: session.verified_customer_email, interaction_summary: result.error ? "Customer verification failed" : "Customer verified", result: result.error ? "verification_failed" : "verified", case_reference: ref });
      return { reply, language, escalated: result.error === "locked", action: result.error === "locked" ? "escalate" : result.error ? "verify" : (isBalanceRequest(data.text) || session.pending_action === "verify_balance") ? "answer" : "verified" };
    }
    if (session.pending_action === "verify_customer") {
      return { reply: "Please enter your account number or registered phone number and your 4-digit verification code together. Never share your PIN, password or OTP.", language, escalated: false, action: "verify" };
    }
    if (isOpeningRequest(data.text)) {
      const reply = "You can open an account without speaking to a person. Select Open an account below to enter sample details, upload sample documents and verify your email. Your test account number is assigned immediately after verification and appears in the admin records. This uses an imaginary banking provider; no real bank account is created.";
      await sb.from("voice_sessions").update({ resolution_state: session.resolution_state === "escalated" ? "escalated" : "pending", transcript: [...transcript, { role: "customer", text: "Requested fictional account opening", at: new Date().toISOString(), lang: language }, { role: "assistant", text: reply, at: new Date().toISOString(), lang: language }] }).eq("id", session.id);
      await log(ctx, { channel: "voice", direction: "outgoing", customer_email: null, interaction_summary: "Self-service fictional account application offered", result: "account_opening", case_reference: ref });
      return { reply, language, escalated: false, action: "account_opening" };
    }
    const pcm = language === "pcm";
    const creds = parseBalanceCredentials(data.text);
    const asksBalance = isBalanceRequest(data.text) || /(?:ow[oóòọ́]+.*(?:akanti|àkọọlẹ)|(?:ego|nguzo).*aka[uụ]nt[uụ]|(?:ma[a’']?auni|ku[dɗ]i).*asusun)/i.test(data.text);
    if (session.pending_action === "balance_locked" && (asksBalance || creds)) {
      const reply = pcm ? `For your safety, balance check don lock for this chat after 3 wrong tries. Our support team go help you — your case reference na ${ref}.` : `For your security, balance checks are locked in this chat after 3 unsuccessful attempts. Our support team will help you — your case reference is ${ref}.`;
      const now = new Date().toISOString();
      await sb.from("voice_sessions").update({ transcript: [...transcript, { role: "customer", text: maskDigits(data.text), at: now, lang: language }, { role: "assistant", text: reply, at: now, lang: language }] }).eq("id", session.id);
      return { reply, language, escalated: true, action: "escalate" };
    }
    if (asksBalance || (session.pending_action === "verify_balance" && creds)) {
      let reply: string; let pending: string | null = null; let attempts = session.verification_attempts ?? 0;
      let verified = session.verified_customer_email as string | null; let escalated = false;
      const naira = (n: number) => `₦${Number(n).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;
      const balanceText = (c: { full_name: string; account_balance: number | null }) => pcm
        ? `Thank you ${c.full_name.split(" ")[0]}, you don verify. Your available balance na ${naira(c.account_balance ?? 0)}. Anything else wey I fit help you with?`
        : `Thank you ${c.full_name.split(" ")[0]}, you are verified. Your available balance is ${naira(c.account_balance ?? 0)}. Is there anything else I can help you with?`;
      if (creds) {
        const { data: cust } = await sb.from("customers").select("id, email, full_name, account_balance").eq("account_number", creds.account).eq("demo_verification_code", creds.code).maybeSingle();
        if (cust) {
          verified = cust.email; reply = balanceText(cust);
          await log(ctx, { channel: "voice", direction: "outgoing", customer_email: cust.email, interaction_summary: "Public visitor verified; balance provided", result: "verified_resolved", case_reference: ref });
        } else {
          attempts += 1;
          if (attempts >= 3) {
            escalated = true; pending = "balance_locked";
            await escalate(ctx, { customer_email: null, channel: "voice", issue_category: "Verification failed", description: "Public visitor failed balance verification 3 times.", priority: "high", case_reference: ref, conversation_summary: "Repeated failed balance verification" });
            reply = pcm ? `Sorry, I no fit verify you. For your safety I don pass am to our support team. Your case reference na ${ref}.` : `I'm sorry, I couldn't verify your details. For your security I've passed this to our support team. Your case reference is ${ref}.`;
          } else {
            pending = "verify_balance";
            reply = pcm ? `Those details no match. Abeg check am and try again — your 10-digit account number and 4-digit verification code. (${3 - attempts} tries remain.)` : `Those details don't match our records. Please check and try again with your 10-digit account number and 4-digit verification code. (${3 - attempts} ${3 - attempts === 1 ? "attempt" : "attempts"} left.)`;
          }
          await log(ctx, { channel: "voice", direction: "outgoing", customer_email: null, interaction_summary: "Balance verification did not match", result: "verification_failed", case_reference: ref });
        }
      } else if (verified) {
        const { data: cust } = await sb.from("customers").select("id, full_name, account_balance").eq("email", verified).single();
        reply = cust ? balanceText(cust) : "I couldn't find your account right now. Please try again.";
      } else {
        pending = "verify_balance";
        reply = pcm ? "I fit check your balance. Abeg type your 10-digit account number and your 4-digit verification code. Never share your PIN, password or OTP." : "I can check your balance. Please enter your 10-digit account number and your 4-digit verification code. Never share your PIN, password or OTP.";
      }
      if (!escalated && !pending && verified) {
        const { data: who } = await sb.from("customers").select("id, full_name, account_balance").eq("email", verified).maybeSingle();
        const { data: accts } = who ? await sb.from("bank_accounts").select("product").eq("customer_id", who.id) : { data: [] };
        const owned = (accts ?? []).map((a: { product: string }) => a.product);
        reply = `${reply.replace(/ (Is there anything else I can help you with\?|Anything else wey I fit help you with\?)$/, "")}\n\n${upsellLine(transcript.map((t) => t.text).join(" "), owned, who ? { firstName: who.full_name.split(" ")[0] ?? "", balance: who.account_balance } : undefined)}`;
      }
      const now = new Date().toISOString();
      const { error } = await sb.from("voice_sessions").update({ resolution_state: escalated || session.resolution_state === "escalated" ? "escalated" : pending ? "pending" : "answered", transcript: [...transcript, { role: "customer", text: maskDigits(data.text), at: now, lang: language }, { role: "assistant", text: reply, at: now, lang: language }], pending_action: pending, verification_attempts: attempts, verified_customer_email: verified }).eq("id", session.id);
      if (error) throw new Error("Could not save your conversation.");
      return { reply, language, escalated, action: escalated ? "escalate" : pending ? "verify" : "answer" };
    }
    const base = await loadBase(ctx);
    // Follow-ups ("what about the interest?") need the conversation context, so they go to the classifier with history.
    const followUp = transcript.some((t) => t.role === "customer") && /^(and|what about|how about|and how|how long|how much|is it|does it|can i|what if|also|then|wetin about|how e)\b|\b(it|that|this|them|those)\b/i.test(data.text.trim());
    const exact = followUp ? undefined : smartVoiceQuestion(data.text, base.voiceTraining, language);
    const c = exact ? trainingClassification(exact, language) : await classify(data.text, base.kb, language, transcript.map((t) => ({ role: t.role, text: t.text })));
    c.language = language;
    const d = publicVoiceDecision(voiceTrainingDecision(data.text, c, base.voiceTraining, language, session.case_reference)
      ?? decide(c, base.kb, "voice", { bank: base.bank, secure: "the secure Kindred app or a branch", ref: session.case_reference }), session.case_reference);
    await log(ctx, { channel: "voice", direction: "incoming", customer_email: null, interaction_summary: c.summary, result: `intent:${c.intent}`, case_reference: session.case_reference });
    const humanNeeded = Boolean(d.escalate) || session.resolution_state === "escalated";
    const { error: ticketError } = await sb.from("escalations").update({ status: "open", ...(d.escalate ? { issue_category: d.escalate.category, priority: d.escalate.priority, description: `Public voice enquiry: ${c.summary}` } : {}), conversation_summary: c.summary, customer_email: session.verified_customer_email }).eq("case_reference", ref);
    if (ticketError) throw new Error("Could not update your support case.");
    let replyText = d.response;
    if (d.action === "answer" && !humanNeeded) {
      
      let owned: string[] = [];
      let profile: { firstName: string; balance: number | null } | undefined;
      if (session.recognized_customer_id) {
        const { data: accts } = await sb.from("bank_accounts").select("product").eq("customer_id", session.recognized_customer_id);
        owned = (accts ?? []).map((a: { product: string }) => a.product);
        const { data: me } = await sb.from("customers").select("full_name, account_balance").eq("id", session.recognized_customer_id).maybeSingle();
        if (me && session.verified_customer_email) profile = { firstName: me.full_name.split(" ")[0] ?? "", balance: me.account_balance };
      }
      replyText = `${d.response}\n\n${upsellLine([...transcript.map((t) => t.text), data.text, d.response].join(" "), owned, profile)}`;
    }
    const { error } = await sb.from("voice_sessions").update({ resolution_state: humanNeeded ? "escalated" : d.action === "answer" ? "answered" : "pending", transcript: [...transcript, { role: "customer", text: maskDigits(data.text), at: new Date().toISOString(), lang: language }, { role: "assistant", text: replyText, at: new Date().toISOString(), lang: language }] }).eq("id", session.id);
    if (error) throw new Error("Could not save your conversation.");
    await log(ctx, { channel: "voice", direction: "outgoing", customer_email: null, interaction_summary: d.response.slice(0, 140), result: d.action, case_reference: session.case_reference });
    return { reply: replyText, language, escalated: Boolean(d.escalate), action: d.action };
    })();
    const source = removeEnglishFallbackNote(result.reply);
    const translated = emit ? await translateVoiceReply(source, language, emit) : await translateBankReply(source, language);
    if (translated !== result.reply) {
      const { data: current } = await sb.from("voice_sessions").select("transcript").eq("id",session.id).single();
      const saved = Array.isArray(current?.transcript) ? current.transcript : [];
      const last = saved[saved.length-1];
      if (last && typeof last === "object" && !Array.isArray(last)) {
        saved[saved.length-1] = { ...last, text: translated };
        const { error } = await sb.from("voice_sessions").update({ transcript: saved }).eq("id",session.id);
        if (error) throw new Error("Could not save the translated reply.");
      }
    }
    return { ...result, reply: translated };

  }

export const publicVoiceClose = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => publicVoiceInput.extend({ escalate: z.boolean() }).parse(d))
  .handler(async ({ data }) => {
    const { sb, session } = await publicVoiceSession(data);
    const ctx: Ctx = { supabase: sb, userId: null };
    if (data.escalate) await sb.from("escalations").update({ issue_category: "Requested human support", priority: "medium", customer_email: session.verified_customer_email }).eq("case_reference", session.case_reference);
    const outcome = await resolveConversation(sb, session, true, data.escalate);
    const reply = await translateBankReply(outcome.reply, publicVoiceLanguage(Array.isArray(session.transcript) ? session.transcript as Turn[] : []));
    await log(ctx, { channel: "voice", direction: "outgoing", customer_email: null, interaction_summary: reply, result: data.escalate ? "escalated" : "ended", case_reference: session.case_reference });
    return { reply };
  });

export const publicVoiceFeedback = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => publicVoiceInput.extend({ satisfied: z.boolean() }).parse(d))
  .handler(async ({ data }) => {
    const { sb, session } = await publicVoiceSession(data);
    let reply: string;
    if (data.satisfied) {
      ({ reply } = await resolveConversation(sb, session, false, false));
    } else {
      const { error } = await sb.from("voice_sessions").update({ resolution_state: session.resolution_state === "escalated" ? "escalated" : "pending" }).eq("id", session.id);
      if (error) throw new Error("Could not save your feedback.");
      const { error: ticketError } = await sb.from("escalations").update({ status: "open" }).eq("case_reference", session.case_reference);
      if (ticketError) throw new Error("Could not reopen your case.");
      reply = "I'm sorry about that. What would you like to know about Kindred Bank? You can pick a question below, ask in your own words, or I can pass it to a member of our team.";
    }
    reply = await translateBankReply(reply, publicVoiceLanguage(Array.isArray(session.transcript) ? session.transcript as Turn[] : []));
    const now = new Date().toISOString();
    const { error } = await sb.from("voice_sessions").update({ transcript: [...(Array.isArray(session.transcript) ? session.transcript : []), { role: "customer", text: data.satisfied ? "Yes" : "No", at: now }, { role: "assistant", text: reply, at: now }] }).eq("id", session.id);
    if (error) throw new Error("Could not save your feedback.");
    return { reply };
  });

export const publicCustomerWelcome = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ forget: z.boolean().default(false) }).parse(d))
  .handler(async ({ data }) => {
    const sb = await admin();
    if (data.forget) { await rememberCustomer(sb, "", false); return { firstName: null }; }
    const customer = await recognizedCustomer(sb);
    return { firstName: customer?.full_name.split(" ")[0] ?? null };
  });

export const auditionNigerianVoice = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => publicVoiceInput.parse(d))
  .handler(async ({ data }) => {
    const { session } = await publicVoiceSession(data);
    const language = publicVoiceLanguage(Array.isArray(session.transcript) ? session.transcript as Turn[] : []);
    const { generateSpeech } = await import("@lovable.dev/ai-gateway");
    const audio = await generateSpeech({
      model: "google/gemini-3.1-flash-tts-preview",
      contents: [{ role: "user", parts: [{ text: `Speak this greeting in natural Nigerian ${language === "ha" ? "Hausa" : language === "ig" ? "Igbo" : language === "yo" ? "Yoruba" : "English"}, with a warm female voice. Say only: ${PHRASES[language].welcome}` }] }],
      generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } } } },
    });
    const blob = await audio.blob();
    return { mime: blob.type || "audio/wav", base64: Buffer.from(await blob.arrayBuffer()).toString("base64") };
  });

export const processWhatsappDemo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    phone: z.string().trim().regex(/^\+?[0-9 ]{7,20}$/, "Enter a phone number"),
    body: z.string().trim().min(1).max(2000),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const phone = data.phone.replace(/\D/g, "");
    const base = await loadBase(ctx);
    const { data: prev } = await ctx.supabase.from("whatsapp_messages").select("language, case_reference")
      .eq("phone", phone).eq("direction", "incoming").order("created_at", { ascending: false }).limit(1);
    const prevLang = (prev?.[0]?.language as Lang | undefined) ?? undefined;
    const ref = (prev?.[0]?.case_reference as string | undefined) ?? caseRef();
    const c = await classify(data.body, base.kb, prevLang);
    const d = decide(c, base.kb, "whatsapp", { bank: base.bank, secure: base.secure, ref });
    const who = `whatsapp:+${phone}`;
    const ins = async (row: { direction: string; body: string; status: string }) => {
      const sb = await admin();
      const { error } = await sb.from("whatsapp_messages").insert({ phone, source: "demo", case_reference: ref, language: d.language, intent: c.intent, ...row });
      if (error) throw new Error(error.message);
    };
    await ins({ direction: "incoming", body: data.body, status: "received" });
    await log(ctx, { channel: "whatsapp", direction: "incoming", customer_email: who, interaction_summary: c.summary, result: `intent:${c.intent}`, case_reference: ref });
    if (d.escalate) await escalate(ctx, { customer_email: who, channel: "whatsapp", issue_category: d.escalate.category,
      description: `${d.escalate.reason}. Customer wrote: ${data.body.slice(0, 1000)}`, priority: d.escalate.priority, case_reference: ref, conversation_summary: c.summary });
    await ins({ direction: "outgoing", body: d.response, status: "demo_not_sent" });
    await log(ctx, { channel: "whatsapp", direction: "outgoing", customer_email: who, interaction_summary: `Demo reply: ${d.response.slice(0, 140)}`, result: d.action, case_reference: ref });
    return { reply: d.response, language: d.language, action: d.action, caseReference: ref, escalated: Boolean(d.escalate) };
  });
