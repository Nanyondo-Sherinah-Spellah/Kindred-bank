import { describe, it, expect } from "vitest";
import { hashVoiceToken, publicVoiceDecision, publicVoiceLanguage, validVoiceCapability } from "@/lib/public-voice-policy";
import type { Decision } from "@/lib/engine.server";

const d = (patch: Partial<Decision> = {}): Decision => ({ action: "answer", language: "en", response: "Approved banking information", escalate: null, ...patch });
describe("public voice privacy", () => {
  it("does not use demo-code verification for public personal enquiries", () => {
    const result = publicVoiceDecision(d({ action: "verify" }), "CS-PUBLIC");
    expect(result.action).toBe("redirect_private");
    expect(result.escalate).toBeNull();
    expect(result.response).not.toContain("4821");
    expect(result.response).not.toContain("UGX");
  });
  it("redirects balance requests instead of exposing account data", () => {
    expect(publicVoiceDecision(d({ escalate: { category: "Personal account enquiry", priority: "low", reason: "Balance" } }), "CS-PUBLIC").action).toBe("redirect_private");
  });
  it("preserves urgent fraud review", () => {
    const fraud = d({ action: "escalate", escalate: { category: "Fraud", priority: "urgent", reason: "OTP scam" } });
    expect(publicVoiceDecision(fraud, "CS-PUBLIC")).toBe(fraud);
  });
  it("honours the first selected language rather than customer input", () => {
    expect(publicVoiceLanguage([{ lang: "pcm" }, { lang: "en" }])).toBe("pcm");
    expect(publicVoiceLanguage([{ lang: "en" }])).toBe("en");
  });
  it("requires the correct session-bound token hash", () => {
    const stored = { token_hash: "abc", expires_at: "2026-11-05T00:00:00Z" };
    expect(validVoiceCapability(stored, "abc", Date.parse("2026-11-04T10:00:00Z"))).toBe(true);
    expect(validVoiceCapability(stored, "different", Date.parse("2026-11-04T10:00:00Z"))).toBe(false);
    expect(validVoiceCapability(null, "abc")).toBe(false);
  });
  it("rejects expired conversation capabilities", () => {
    expect(validVoiceCapability({ token_hash: "abc", expires_at: "2026-11-04T00:00:00Z" }, "abc", Date.parse("2026-11-05T00:00:00Z"))).toBe(false);
  });
  it("stores a hash rather than a reusable raw capability", async () => {
    const token = "a".repeat(64);
    const hash = await hashVoiceToken(token);
    expect(hash).toHaveLength(64);
    expect(hash).not.toBe(token);
    expect(await hashVoiceToken("b".repeat(64))).not.toBe(hash);
  });
});