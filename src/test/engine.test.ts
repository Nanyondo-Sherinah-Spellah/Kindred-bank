import { describe, expect, it } from "vitest";
import { decide, detectGreeting, keywordMatch, type Classification, type KnowledgeRow } from "@/lib/engine.server";
import { INTERNAL_KB } from "@/lib/kindred-kb.server";
import { bankTimeOfDay, PHRASES } from "@/lib/lang";

const kb: KnowledgeRow[] = [
  { id: "k1", topic: "Business loan requirements", keywords: ["business loan", "loan documents"], approved_answer: "A business loan applicant should prepare valid identification, proof of income and relevant business records.", category: "Loans" },
  { id: "k2", topic: "Branch hours", keywords: ["branch hours", "open"], approved_answer: "Branches open Monday to Friday, 8:00am to 4:00pm.", category: "Branches" },
];
const opts = { bank: "Kindred Bank", secure: "our secure private support channel", ref: "CS-TEST" };
const c = (o: Partial<Classification>): Classification => ({ intent: "general", knowledgeId: null, summary: "", engine: "ai", language: "en", ...o });

describe("conversation behaviour", () => {
  it("answers 'Good morning' warmly and introduces itself", () => {
    const d = decide(c({ intent: "greeting", greeted: "morning" }), kb, "social", opts);
    expect(d.response).toMatch(/^Good morning! Welcome to Kindred Bank/);
    expect(d.response).toContain("virtual assistant");
  });

  it("asks personal or business loan before answering a broad loan question", () => {
    const d = decide(c({ answerType: "clarify", clarifyOptions: ["a personal loan", "a business loan"] }), kb, "voice", opts);
    expect(d.action).toBe("clarify");
    expect(d.response).toContain("a personal loan or a business loan");
  });

  it("detects greetings in local languages", () => {
    expect(detectGreeting("Ina kwana")).toBe("morning");
    expect(detectGreeting("How far")).toBe("none");
  });
});

describe("yes/no reasoning", () => {
  it("leads with Yes when the document supports it", () => {
    const d = decide(c({ knowledgeId: "k1", answerType: "yes_no", yesNo: "yes" }), kb, "social", opts);
    expect(d.response.startsWith("Yes.")).toBe(true);
    expect(d.response).toContain(kb[0]!.approved_answer);
  });
  it("does not say yes when the document does not confirm", () => {
    const d = decide(c({ knowledgeId: "k1", answerType: "yes_no", yesNo: "unconfirmed" }), kb, "social", opts);
    expect(d.response).not.toMatch(/^Yes/);
    expect(d.response).toContain("not able to confirm");
  });
});

describe("accuracy, escalation and privacy", () => {
  it("escalates when no approved answer exists", () => {
    const d = decide(c({ knowledgeId: null }), kb, "whatsapp", opts);
    expect(d.action).toBe("escalate");
    expect(d.response).toContain("CS-TEST");
  });
  it("same question gives the same approved text on every channel", () => {
    const cls = c({ knowledgeId: "k2", answerType: "explanation" });
    for (const ch of ["email", "social", "voice", "whatsapp"] as const) {
      expect(decide(cls, kb, ch, opts).response).toContain("8:00am to 4:00pm. All times are Nigerian time (WAT).");
    }
  });
  it("redirects personal enquiries on public social posts", () => {
    const d = decide(c({ intent: "personal_account" }), kb, "social", opts);
    expect(d.action).toBe("redirect_private");
    expect(d.response).not.toMatch(/₦|NGN|\d{4}/);
  });
  it("voice asks for verification before personal data", () => {
    expect(decide(c({ intent: "personal_account" }), kb, "voice", opts).action).toBe("verify");
  });
  it("bank time zone is Lagos (07:30 UTC is 08:30 morning)", () => {
    expect(bankTimeOfDay(new Date("2026-11-03T07:30:00Z"))).toBe("morning");
    expect(bankTimeOfDay(new Date("2026-11-03T16:30:00Z"))).toBe("evening");
  });
  it("internal knowledge answers branch hours", () => {
    expect(keywordMatch("What are your branch opening hours?", INTERNAL_KB)).not.toBeNull();
  });
});

describe("local languages", () => {
  it.each([
    ["pcm", "How far"], ["yo", "Ẹ n lẹ́"], ["ig", "Ndewo"], ["ha", "Sannu"],
  ] as const)("replies in %s and keeps policy text in approved English", (lang, hello) => {
    const g = decide(c({ intent: "greeting", greeted: "none", language: lang }), kb, "whatsapp", opts);
    expect(g.response).toContain(hello);
    expect(g.response).toContain(PHRASES[lang].welcome);
    const a = decide(c({ knowledgeId: "k1", language: lang }), kb, "whatsapp", opts);
    expect(a.language).toBe(lang);
    expect(a.response).toContain(PHRASES[lang].englishNote);
    expect(a.response).toContain(kb[0]!.approved_answer);
  });
  it("unsupported language escalates politely in English", () => {
    const d = decide(c({ language: "unsupported" }), kb, "email", opts);
    expect(d.action).toBe("escalate");
    expect(d.response).toContain("English, Nigerian Pidgin, Yoruba, Igbo and Hausa");
  });
});
