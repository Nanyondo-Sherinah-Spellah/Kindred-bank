import { yarnJobStatus, yarnStartTts } from "@/lib/yarngpt.functions";
import type { Lang } from "@/lib/lang";

// Idera speaks every language so the assistant has one consistent Nigerian officer voice across English, Pidgin, Yoruba, Hausa and Igbo.
const VOICE: Record<Lang, string> = { en: "idera", pcm: "idera", yo: "idera", ha: "idera", ig: "idera" };
let current: HTMLAudioElement | null = null;
let token = 0;
// One reused audio element, unlocked on the visitor's first tap, so browsers allow later replies to play after the slow audio generation.
let shared: HTMLAudioElement | null = null;
const SILENT = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";
function player() { if (!shared) shared = new Audio(); return shared; }
if (typeof window !== "undefined") {
  const unlock = () => { const a = player(); if (!a.src) { a.src = SILENT; a.play().catch(() => {}); } window.removeEventListener("pointerdown", unlock); window.removeEventListener("keydown", unlock); };
  window.addEventListener("pointerdown", unlock); window.addEventListener("keydown", unlock);
}

export function stopYarn() { token++; current?.pause(); current = null; }

/** Splits text into sentence chunks under the 500-char API limit so nothing is cut off; first chunk is short so audio starts sooner. */
export function chunkSpeech(text: string, max = 480, firstMax = 160): string[] {
  const sentences = text.replace(/\s+/g, " ").trim().match(/[^]*?(?:[.!?](?=\s|$)\s*|$)/g)?.filter(Boolean) ?? [];
  const out: string[] = [];
  let cur = "";
  for (const raw of sentences) {
    let s = raw;
    let limit = out.length === 0 ? Math.min(firstMax, max) : max;
    while (s.length > limit) { const cut = s.lastIndexOf(" ", limit) > 0 ? s.lastIndexOf(" ", limit) : limit; if (cur) { out.push(cur.trim()); cur = ""; } out.push(s.slice(0, cut).trim()); s = s.slice(cut); limit = max; }
    if (cur && (cur + s).length > limit) { out.push(cur.trim()); cur = ""; }
    cur += s;
  }
  if (cur.trim()) out.push(cur.trim());
  return out.filter(Boolean);
}

async function waitAudio(jobId: string, mine: number): Promise<string | null> {
  for (let i = 0; i < 80; i++) {
    await new Promise((ok) => setTimeout(ok, i < 5 ? 400 : 900));
    if (mine !== token) return null;
    const s = await yarnJobStatus({ data: { jobId } });
    if (s.status === "completed" && s.audioUrl) return s.audioUrl;
    if (s.status === "failed") throw new Error("failed");
  }
  throw new Error("timeout");
}

/** Accepts translated segments immediately, preparing audio while later text is still translating. */
export function yarnSpeechQueue(lang: Lang, onPlaying?: () => void) {
  stopYarn();
  const mine = token;
  let sequence = Promise.resolve();
  let started = false;
  let failure: string | null = null;
  return {
    append(text: string) {
      if (mine !== token || failure) return;
      const chunks = chunkSpeech(text, 480, (lang === "yo" || lang === "ha" || lang === "ig") ? 120 : 160);
      for (const chunk of chunks) {
        const ready = (async () => {
          const r = await yarnStartTts({ data: { text: chunk, voice: VOICE[lang] } });
          if (!r.jobId) throw new Error(r.error ?? "Voice generation failed");
          return waitAudio(r.jobId, mine);
        })();
        void ready.catch((error: unknown) => { failure = error instanceof Error ? error.message : "Voice generation failed"; });
        sequence = sequence.then(async () => {
      const url = await ready;
      if (mine !== token || !url) return;
      const audio = player();
      current = audio;
      audio.src = url;
      await new Promise<void>((done, fail) => {
        audio.onended = () => done();
        audio.onerror = () => fail(new Error("Audio unavailable"));
        audio.onplaying = () => { if (!started) { started = true; onPlaying?.(); } };
        audio.play().catch(fail);
      });
        }).then(() => {});
        void sequence.catch(() => {});
      }
    },
    async finished() {
      try { await sequence; return started || mine !== token; }
      catch { return mine !== token; }
    },
  };
}

/** Speaks every segment in order, with no truncation. */
export async function playYarn(text: string, lang: Lang): Promise<boolean> {
  const queue = yarnSpeechQueue(lang);
  queue.append(text);
  return queue.finished();
}
