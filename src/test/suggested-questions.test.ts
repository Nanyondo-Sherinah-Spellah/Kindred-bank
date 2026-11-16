import { describe, expect, it } from "vitest";
import { questionsInLanguage } from "@/lib/suggested-questions";

describe("suggested question language isolation", () => {
  const questions = ["en", "pcm", "ha", "ig", "yo"].map((language) => ({ id: language, language, category: "Policies", question: language }));
  it.each(["en", "pcm", "ha", "ig", "yo"] as const)("shows only %s suggestions without English fallback", (language) => {
    expect(questionsInLanguage(questions, language, "Policies").map((q) => q.id)).toEqual([language]);
    expect(questionsInLanguage(questions, language, "Complaints")).toEqual([]);
  });
});