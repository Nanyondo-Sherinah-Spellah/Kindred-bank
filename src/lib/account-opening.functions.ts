import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { applicationSchema } from "./account-opening";
import { hashVoiceToken } from "./public-voice-policy";
const credentials = z.object({ id: z.uuid(), token: z.string().regex(/^[a-f0-9]{64}$/) });
export const beginApplication = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => applicationSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin: sb } = await import("@/integrations/supabase/client.server");
    const { full_name, email, phone, channel, documents, simulated_email, fictional, ...details } =
      data;
    const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join("");
    const code = String((crypto.getRandomValues(new Uint32Array(1))[0] ?? 0) % 1000000).padStart(
      6,
      "0",
    );
    const { data: a, error } = await sb
      .from("bank_applications")
      .insert({
        full_name,
        email,
        phone,
        channel,
        documents,
        details: { ...details, email_mode: simulated_email ? "simulated" : "gmail" },
      })
      .select("id,reference")
      .single();
    if (error || !a) throw new Error("Could not save the application.");
    const { error: accessError } = await sb
      .from("bank_application_access")
      .insert({
        application_id: a.id,
        token_hash: await hashVoiceToken(token),
        code_hash: await hashVoiceToken(code),
        expires_at: new Date(Date.now() + 15 * 60000).toISOString(),
      });
    if (accessError) throw new Error("Could not secure the application.");
    await sb.from("bank_application_access").update({ email_sent: true }).eq("application_id", a.id);
    // Open immediately: complete the application server-side, then email the details.
    const { data: result, error: rpcError } = await sb.rpc("complete_test_application", {
      p_id: a.id,
      p_hash: await hashVoiceToken(token),
      p_code_hash: await hashVoiceToken(code),
    });
    if (rpcError) throw new Error("Could not open the account. Please try again.");
    const r = result as { error?: string; accounts?: { account_number: string; product: string; holder: string }[]; verification_code?: string; reference?: string };
    if (r.error) throw new Error(r.error);
    const emailed: boolean | null = simulated_email || !email ? null : await emailAccountDetails(email, full_name, r);
    return { ...r, emailed, email };
  });
async function emailAccountDetails(to: string, name: string, r: { accounts?: { account_number: string; product: string; holder: string }[]; verification_code?: string; reference?: string }) {
  if (!r.accounts?.length) return false;
  try {
    const { sendViaGmail } = await import("./cs.functions");
    const list = r.accounts.map((x) => `- ${x.product} (${x.holder}): ${x.account_number}`).join("\n");
    await sendViaGmail(to, "Kindred Bank — your new account details",
      `Dear ${name},\n\nWelcome to Kindred Bank. Your account is now open.\n\nAccount number(s):\n${list}\n\nLogin details for the Kindred Chatbot and Voice Agent:\n- Account number: ${r.accounts[0]!.account_number}\n- 4-digit verification code: ${r.verification_code}\n\nUse these to check your balance at https://kindred-bank-concierge.lovable.app. Keep this code private and never share your PIN, password or OTP with anyone.\n\nReference: ${r.reference}\n\nKindred Bank — The Bank That Knows You`);
    return true;
  } catch (e) {
    console.error("Account details email failed", e);
    return false;
  }
}
export const verifyApplication = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    credentials.extend({ code: z.string().regex(/^\d{6}$/) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin: sb } = await import("@/integrations/supabase/client.server");
    const { data: result, error } = await sb.rpc("complete_test_application", {
      p_id: data.id,
      p_hash: await hashVoiceToken(data.token),
      p_code_hash: await hashVoiceToken(data.code),
    });
    if (error) throw new Error("Could not complete the application.");
    const r = result as {
      error?: string;
      accounts?: { account_number: string; product: string; holder: string }[];
      verification_code?: string;
      reference?: string;
    };
    if (r.error) throw new Error(r.error);
    let emailed = false;
    const { data: app } = await sb.from("bank_applications").select("email, full_name, details").eq("id", data.id).single();
    const mode = (app?.details as { email_mode?: string } | null)?.email_mode;
    if (app && mode !== "simulated" && r.accounts?.length) {
      try {
        const { sendViaGmail } = await import("./cs.functions");
        const list = r.accounts.map((a) => `- ${a.product} (${a.holder}): ${a.account_number}`).join("\n");
        await sendViaGmail(app.email, "Kindred Bank — your new account details",
          `Dear ${app.full_name},\n\nWelcome to Kindred Bank. Your account is now open.\n\nAccount number(s):\n${list}\n\nLogin details for the Kindred Chatbot and Voice Agent:\n- Account number: ${r.accounts[0]!.account_number}\n- 4-digit verification code: ${r.verification_code}\n\nUse these to check your balance at https://kindred-bank-concierge.lovable.app. Keep this code private and never share your PIN, password or OTP with anyone.\n\nReference: ${r.reference}\n\nKindred Bank — The Bank That Knows You`);
        emailed = true;
      } catch (e) {
        console.error("Account details email failed", e);
      }
    }
    return { ...r, emailed };
  });
export const adminApplications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: allowed } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!allowed) throw new Error("Forbidden");
    const { data, error } = await context.supabase
      .from("bank_applications")
      .select("*, bank_accounts(*)")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });
