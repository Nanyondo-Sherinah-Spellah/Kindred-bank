import { describe, it, expect } from "vitest";
import { chunkSpeech } from "@/lib/yarngpt-play";
describe("chunkSpeech", () => {
  it("keeps decimal rates intact in spoken chunks", () => expect(chunkSpeech("Goal Saver pays 6.0% per year.").join(" ")).toBe("Goal Saver pays 6.0% per year."));
  it("limits the first Yoruba audio chunk to 120 characters even for a long sentence", () => {
    const text = Array.from({ length: 70 }, () => "Ẹ káàbọ̀ sí Kindred Bank").join(" ") + ".";
    const chunks = chunkSpeech(text, 480, 120);
    expect(chunks[0]?.length).toBeLessThanOrEqual(120);
    expect(chunks.join(" ")).toBe(text);
  });
  it("keeps every word of a long Pidgin reply, each chunk under 500 chars", () => {
    const text = Array.from({ length: 30 }, (_, i) => `Dis na sentence number ${i} wey dey explain di account well well.`).join(" ");
    const chunks = chunkSpeech(text);
    expect(chunks.every((c) => c.length <= 500)).toBe(true);
    expect(chunks.join(" ").replace(/\s+/g, " ")).toBe(text);
  });
});
