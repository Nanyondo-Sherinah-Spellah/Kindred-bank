import type { Decision } from "./engine.server";
import type { Lang } from "./lang";

export function publicVoiceDecision(decision: Decision, ref: string): Decision {
  if (decision.action !== "verify" && decision.escalate?.category !== "Personal account enquiry") return decision;
  return {
    action: "redirect_private", language: decision.language, escalate: null,
    response: decision.language === "pcm"
      ? `For your security, I no fit show account details for this public chat. Abeg use the secure Kindred app or visit a branch for proper verification. No share PIN, OTP, password or verification code here. Your case reference na ${ref}.`
      : `For your security, personal account details are not available in this public chat. Please use the secure Kindred app or visit a branch for identity verification. Do not share your PIN, OTP, password or verification code here. Your case reference is ${ref}.`,
  };
}

export function isBalanceRequest(text: string) {
  return /\b(balance|how much (money )?(do i have|is in my account|dey (for )?my account))\b/i.test(text);
}

/** Pulls a 10-digit account number and a 4-digit code from what the customer typed or said. */
export function parseBalanceCredentials(text: string): { account: string; code: string } | null {
  const groups = text.match(/\d+/g) ?? [];
  const account = groups.find((g) => g.length === 10);
  const code = groups.find((g) => g.length === 4);
  if (account && code) return { account, code };
  const all = groups.join(""); // speech often splits numbers: "0123 454 821 4821"
  return all.length === 14 ? { account: all.slice(0, 10), code: all.slice(10) } : null;
}

export function maskDigits(text: string) {
  return text.replace(/\d/g, "•");
}

export async function hashVoiceToken(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function validVoiceCapability(stored: { token_hash: string; expires_at: string } | null, hash: string, now = Date.now()) {
  return Boolean(stored && stored.token_hash === hash && Date.parse(stored.expires_at) > now);
}

export function publicVoiceLanguage(transcript: { lang?: Lang }[]): Lang {
  return transcript[0]?.lang ?? "en";
}