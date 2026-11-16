import { describe, expect, it } from "vitest";
import { exactVoiceQuestion, trainingClassification, voiceKnowledge, voiceTrainingDecision, type VoiceTraining } from "@/lib/voice-training";

const row = (changes: Partial<VoiceTraining> = {}): VoiceTraining => ({ id: "q1", question: "What documents do I need to open an account?", language: "en", approved_answer: "A valid ID, BVN and a passport photo. Shall I explain the account tiers?", topic: "Account opening", keywords: ["open account"], intent: "general", sort_order: 0, ...changes });
const answer = (r: VoiceTraining, lang: "en" | "pcm" = "en") => voiceTrainingDecision(r.question, trainingClassification(r, lang), [r], lang, "CS-VOICE-TEST");

describe("uploaded voice question rules", () => {
  it("matches an uploaded question regardless of punctuation and case", () => {
    expect(exactVoiceQuestion("WHAT DOCUMENTS DO I NEED TO OPEN AN ACCOUNT", [row()])?.id).toBe("q1");
    expect(exactVoiceQuestion("How much money do I have?", [row()])).toBeUndefined();
  });
  it("honours English when the selected question is in Pidgin", () => {
    const r = row({ language: "pcm", question: "How far? I wan open account, wetin I go do?" });
    expect(answer(r, "en")?.language).toBe("en");
  });
  it("uses the approved Pidgin variant for account opening", () => {
    const english = row();
    const pidgin = row({ id: "q2", language: "pcm", topic: "Account opening in Pidgin", approved_answer: "E good! Which way you go prefer?" });
    const d = voiceTrainingDecision(english.question, trainingClassification(english, "pcm"), [english, pidgin], "pcm", "CS-TEST");
    expect(d?.language).toBe("pcm");
    expect(d?.action).toBe("answer");
  });
  it("does not treat the Yoruba upload as Pidgin knowledge", () => {
    const r = row({ language: "yo", topic: "Loans in Yoruba" });
    expect(voiceKnowledge([r])).toHaveLength(0);
  });
  it.each(["fraud", "missing_funds", "complaint"])("creates a human-review action for %s instead of a general answer", (intent) => {
    const d = answer(row({ intent }));
    expect(d?.action).toBe("escalate");
    expect(d?.escalate?.priority).toBe(intent === "fraud" ? "urgent" : "high");
  });
  it("does not offer demonstration repayment verification for a balance question", () => {
    const d = answer(row({ intent: "personal_account", topic: "Account balance" }));
    expect(d?.action).toBe("escalate");
    expect(d?.escalate?.category).toBe("Personal account enquiry");
  });
  it("cannot override a fraud classification with a general answer", () => {
    const r = row();
    expect(voiceTrainingDecision(r.question, { ...trainingClassification(r, "en"), intent: "fraud" }, [r], "en", "CS-TEST")).toBeNull();
  });
  it("does not reuse the ₦500,000 six-month example for a different amount", () => {
    const r = row({ topic: "Fixed deposit example", question: "I want to put ₦500,000 in a fixed deposit for six months. What will I earn?" });
    expect(voiceTrainingDecision("What will ₦100,000 earn for six months?", trainingClassification(r, "en"), [r], "en", "CS-TEST")).toBeNull();
    expect(answer(r)?.action).toBe("answer");
  });
  it("never puts private or incident answers into general banking knowledge", () => {
    expect(voiceKnowledge([row({ intent: "personal_account" }), row({ intent: "fraud" }), row()]).map((r) => r.id)).toEqual(["q1"]);
  });
});