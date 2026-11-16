import { describe, expect, it } from "vitest";
import { questionReadBack, readVoiceReply, translationChunks } from "@/lib/voice-reply-stream";

describe("incremental approved translations", () => {
  it.each(["Báwo ni mo ṣe lè ṣí àkáǹtì?", "Kedu oge unu na-emeghe?", "Yaya zan bude asusu?"])("reads the customer's %s question unchanged", (text) => expect(questionReadBack(text)).toBe(text));
  it("does not read confidential verification details aloud", () => expect(questionReadBack("0123454821 code 4821")).toBe(""));
  it("emits the first complete thought separately without splitting rates or dropping qualifications", () => {
    const source = "Goal Saver pays 6.0% annually. Withdrawals are restricted until maturity. Please contact the bank for help.";
    const chunks = translationChunks(source);
    expect(chunks[0]).toBe("Goal Saver pays 6.0% annually.");
    expect(chunks.join(" ")).toBe(source);
  });
  it("delivers an early chunk before the final reply arrives", async () => {
    const encoder = new TextEncoder();
    let finish: (() => void) | undefined;
    const response = new Response(new ReadableStream({ start(controller) {
      controller.enqueue(encoder.encode('{"type":"chunk","text":"Ẹ káàbọ̀."}\n'));
      finish = () => { controller.enqueue(encoder.encode('{"type":"done","reply":"Ẹ káàbọ̀.","action":"answer","escalated":false}\n')); controller.close(); };
    } }));
    const seen: string[] = [];
    const reading = readVoiceReply(response, (event) => { seen.push(event.type); if (event.type === "chunk") { expect(seen).toEqual(["chunk"]); finish?.(); } });
    await reading;
    expect(seen).toEqual(["chunk", "done"]);
  });
});