import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

const GATEWAY = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";

function headers() {
  return {
    Authorization: `Bearer ${process.env["LOVABLE_API_KEY"]}`,
    "X-Connection-Api-Key": process.env["GOOGLE_MAIL_API_KEY"]!,
  };
}

async function gmail(path: string) {
  const res = await fetch(`${GATEWAY}${path}`, { headers: headers() });
  if (!res.ok) throw new Error(`Gmail request failed [${res.status}]: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

function decode(data: string) {
  const bin = atob(data.replace(/-/g, "+").replace(/_/g, "/"));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

function plainText(part: any): string {
  if (part?.mimeType === "text/plain" && part.body?.data) return decode(part.body.data);
  for (const p of part?.parts ?? []) {
    const t = plainText(p);
    if (t) return t;
  }
  if (part?.mimeType === "text/html" && part.body?.data) return decode(part.body.data).replace(/<[^>]+>/g, " ");
  return "";
}

// Drop quoted earlier replies so only the customer's new words are analysed.
function stripQuoted(text: string) {
  const cut = text.search(/\n(On .+wrote:|-{2,}\s*Original Message|>)/);
  return (cut > 0 ? text.slice(0, cut) : text).trim();
}

export const Route = createFileRoute("/api/public/jobs/gmail-poll")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authFailure = await authenticateCronRequest(request);
        if (authFailure) return authFailure;
        if (!process.env["GOOGLE_MAIL_API_KEY"] || !process.env["LOVABLE_API_KEY"]) {
          return Response.json({ error: "Gmail is not connected" }, { status: 500 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { runIncomingEmail } = await import("@/lib/cs.functions");

        const profile = await gmail("/users/me/profile");
        const me = String(profile.emailAddress).toLowerCase();
        const q = encodeURIComponent("in:inbox newer_than:2d -from:me -category:promotions -category:social");
        const list = await gmail(`/users/me/messages?maxResults=20&q=${q}`);
        const ids: string[] = (list.messages ?? []).map((m: any) => m.id);
        if (!ids.length) return Response.json({ processed: 0 });

        const { data: seen } = await supabaseAdmin.from("email_messages").select("gmail_message_id").in("gmail_message_id", ids);
        const done = new Set((seen ?? []).map((r) => r.gmail_message_id));
        const results: { id: string; status: string }[] = [];

        for (const id of ids.filter((x) => !done.has(x)).reverse()) {
          try {
            const m = await gmail(`/users/me/messages/${id}?format=full`);
            const h = (n: string) => m.payload?.headers?.find((x: any) => x.name.toLowerCase() === n)?.value ?? "";
            const fromHeader = h("from");
            const sender = (fromHeader.match(/<([^>]+)>/)?.[1] ?? fromHeader).trim().toLowerCase();
            const automated = /no-?reply|mailer-daemon|postmaster|notifications?@/i.test(sender) || h("auto-submitted").toLowerCase().startsWith("auto") || !!h("list-unsubscribe");
            if (!sender.includes("@") || sender === me || automated) {
              await supabaseAdmin.from("email_messages").insert({ sender: sender || "unknown", subject: h("subject").slice(0, 300), body: "(skipped automated message)", case_reference: `SKIP-${id}`, status: "skipped", source: "gmail", gmail_message_id: id });
              results.push({ id, status: "skipped" });
              continue;
            }
            const body = (stripQuoted(plainText(m.payload)) || m.snippet || "(empty message)").slice(0, 5000);
            const r = await runIncomingEmail(
              { supabase: supabaseAdmin, userId: null },
              { sender, subject: h("subject").slice(0, 300), body, auto: true },
              { id, threadId: m.threadId, messageId: h("message-id") || undefined },
            );
            results.push({ id, status: r.delivery?.status ?? (r.decision.escalate ? "escalated" : "pending_review") });
          } catch (e) {
            console.error("gmail-poll message failed", id, e);
            results.push({ id, status: `error: ${e instanceof Error ? e.message : String(e)}` });
          }
        }
        return Response.json({ processed: results.length, results });
      },
    },
  },
});
