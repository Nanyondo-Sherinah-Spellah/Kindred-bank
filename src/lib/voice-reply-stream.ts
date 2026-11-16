export type VoiceReplyEvent =
  | { type: "chunk"; text: string }
  | { type: "done"; reply: string; action: string; escalated: boolean }
  | { type: "error"; message: string };

// Never repeat numbers or security credentials through a public speaker.
export function questionReadBack(text: string): string {
  return /\d|\b(?:PIN|OTP|password|verification code)\b/i.test(text) ? "" : text.trim();
}

// Keep complete sentences (including qualifications) together; do not split decimals.
export function translationChunks(text: string): string[] {
  const sentences = text.trim().match(/[^]*?(?:[.!?](?=\s+[A-Z]|\s*$)|$)/g)?.filter((s) => s.trim()) ?? [];
  const [first, ...rest] = sentences;
  if (!first) return [];
  const chunks = [first.trim()];
  for (const sentence of rest) {
    const last = chunks.length - 1;
    if (last > 0 && `${chunks[last]} ${sentence.trim()}`.length <= 600) chunks[last] += ` ${sentence.trim()}`;
    else chunks.push(sentence.trim());
  }
  return chunks;
}

export async function readVoiceReply(response: Response, receive: (event: VoiceReplyEvent) => void) {
  if (!response.ok || !response.body) throw new Error("Voice reply unavailable");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      pending += decoder.decode(value, { stream: !done });
      const lines = pending.split("\n");
      pending = lines.pop() ?? "";
      for (const line of lines) if (line.trim()) receive(JSON.parse(line) as VoiceReplyEvent);
      if (done) break;
    }
    if (pending.trim()) receive(JSON.parse(pending) as VoiceReplyEvent);
  } finally { reader.releaseLock(); }
}