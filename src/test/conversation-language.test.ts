import { describe, expect, it } from "vitest";
import { feedbackAnswer, LANGUAGE_LOCALE, protectTranslationValues, restoreTranslationValues } from "@/lib/conversation-language";
import { publicVoiceLanguage } from "@/lib/public-voice-policy";

describe("Nigerian language safeguards", () => {
  it.each(["ha", "ig", "yo"] as const)("retains selected %s language across turns", (lang) => expect(publicVoiceLanguage([{ lang }, { lang: "en" }])).toBe(lang));
  it("uses Nigerian speech locales", () => expect([LANGUAGE_LOCALE.ha, LANGUAGE_LOCALE.ig, LANGUAGE_LOCALE.yo]).toEqual(["ha-NG", "ig-NG", "yo-NG"]));
  it.each([["Eh", true], ["Ee", true], ["Bẹ́ẹ̀ni", true], ["A'a", false], ["Mba", false], ["Rárá", false]] as const)("understands %s feedback", (text, expected) => expect(feedbackAnswer(text)).toBe(expected));
  it("preserves bank products, fees, balances and case references", () => {
    const source = "Goal Saver: ₦5,000, 6.0% a year. Case CS-20261112-ABCDE.";
    const protectedText = protectTranslationValues(source);
    expect(restoreTranslationValues(protectedText.text, protectedText.values)).toBe(source);
    expect(() => restoreTranslationValues(protectedText.text.replace("__VALUE_1__", "₦10,000"), protectedText.values)).toThrow();
    expect(() => restoreTranslationValues(protectedText.text + " 12%", protectedText.values)).toThrow();
  });
});