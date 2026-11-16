import { describe, expect, it } from "vitest";
import { preferredBrowserVoice } from "@/lib/browser-voice";

const voice = (name: string, lang: string, isDefault = false) => ({ name, lang, default: isDefault });

describe("female Nigerian voice preference", () => {
  it("prefers Nigerian female Ezinne over Nigerian male Abeo and foreign female voices", () => {
    expect(preferredBrowserVoice([voice("Samantha", "en-US", true), voice("Microsoft Abeo", "en-NG"), voice("Microsoft Ezinne", "en-NG")])?.name).toBe("Microsoft Ezinne");
  });
  it("uses an available female English fallback when no Nigerian female voice exists", () => {
    expect(preferredBrowserVoice([voice("Microsoft Abeo", "en-NG"), voice("Microsoft Sonia", "en-GB")])?.name).toBe("Microsoft Sonia");
  });
  it("does not choose a non-English voice merely because it is female", () => {
    expect(preferredBrowserVoice([voice("Female", "fr-FR"), voice("English default", "en-US", true)])?.name).toBe("English default");
  });
  it("returns no voice when none are installed", () => {
    expect(preferredBrowserVoice([])).toBeNull();
  });
});