import { getCookie, setCookie, deleteCookie, getRequestUrl } from "@tanstack/react-start/server";
import { hashVoiceToken } from "./public-voice-policy";
import { DEVICE_MAX_AGE, selectProductOffer } from "./customer-conversation";
import { INTERNAL_KB } from "./kindred-kb.server";

const COOKIE = "kindred_customer_device";
export async function recognizedCustomer(sb: any) {
  const token = getCookie(COOKIE);
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const { data } = await sb.from("customer_device_access").select("customer_id").eq("token_hash", await hashVoiceToken(token)).gt("expires_at", new Date().toISOString()).maybeSingle();
  if (!data) { deleteCookie(COOKIE, { path: "/" }); return null; }
  const { data: customer } = await sb.from("customers").select("id,full_name").eq("id", data.customer_id).maybeSingle();
  return customer;
}

export async function rememberCustomer(sb: any, customerId: string, remember: boolean) {
  const previous = getCookie(COOKIE);
  if (previous) await sb.from("customer_device_access").delete().eq("token_hash", await hashVoiceToken(previous));
  deleteCookie(COOKIE, { path: "/" });
  if (!remember) return;
  const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, "0")).join("");
  const { error } = await sb.from("customer_device_access").insert({ token_hash: await hashVoiceToken(token), customer_id: customerId, expires_at: new Date(Date.now() + DEVICE_MAX_AGE * 1000).toISOString() });
  if (error) throw new Error("Could not remember this device.");
  setCookie(COOKIE, token, { httpOnly: true, secure: getRequestUrl().protocol === "https:", sameSite: "lax", path: "/", maxAge: DEVICE_MAX_AGE });
}

export async function resolveConversation(sb: any, session: any, end: boolean, escalate: boolean) {
  const { data, error } = await sb.rpc("resolve_voice_conversation", { p_session: session.id, p_end: end, p_escalate: escalate });
  if (error || data?.error) throw new Error("Could not save the conversation outcome.");
  let offer = null;
  if (data.offer && session.verified_customer_email) {
    const { data: customer } = await sb.from("customers").select("id").eq("email", session.verified_customer_email).single();
    const { data: accounts, error: accountError } = await sb.from("bank_accounts").select("product").eq("customer_id", customer?.id).in("status", ["active", "active_test"]);
    if (accountError) throw new Error("Could not check your products.");
    offer = selectProductOffer((accounts ?? []).map((a: { product: string }) => a.product), INTERNAL_KB);
  }
  const reply = data.human_needed
    ? `Your request remains open for human review. Contact a Kindred branch with case reference ${session.case_reference}. This is not a live telephone transfer.`
    : data.resolved
      ? `Thank you! Your request is resolved. ${offer ? `You may also be interested in ${offer.product}, which is not listed among your current accounts. ${offer.detail} Would you like to know more?` : "If you have another question, just ask."}`
      : "Thank you for contacting Kindred Bank. Your request remains open because it has not been confirmed as resolved.";
  return { reply, resolved: Boolean(data.resolved), offer: offer?.product ?? null };
}