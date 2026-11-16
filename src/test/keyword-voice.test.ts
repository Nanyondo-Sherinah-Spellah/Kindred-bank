import { describe, expect, it } from "vitest";
import { smartVoiceQuestion, type VoiceTraining } from "@/lib/voice-training";

const row = (id: string, question: string, keywords: string[], topic: string): VoiceTraining => ({ id, question, keywords, topic, language: "en", approved_answer: id, intent: "general", sort_order: 0 });
const rows = [
  row("atm", "How much do you charge for ATM withdrawals?", ["atm fee", "atm withdrawal", "atm charge"], "ATM fees"),
  row("salary", "Can I get a salary loan?", ["salary loan", "salary advance"], "Salary loan"),
];

describe("voice key word matching", () => {
  it("picks the approved answer from key words in a differently worded request", () => {
    expect(smartVoiceQuestion("hello, what is the atm charge if I withdraw from another bank", rows)?.id).toBe("atm");
  });
  it("does not guess when nothing fits", () => expect(smartVoiceQuestion("tell me about crypto", rows)).toBeUndefined());
});
