import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const BASE = "https://api.yarngpt.ai/api/v1";

function key() {
  const k = process.env['YARNGPT_API_KEY'];
  if (!k) throw new Error("YarnGPT key is not configured");
  return k;
}

export const yarnListVoices = createServerFn({ method: "GET" }).handler(async () => {
  const res = await fetch(`${BASE}/voices`, { headers: { Authorization: `Bearer ${key()}` } });
  if (!res.ok) return { voices: [] as { name: string }[], error: `Voices failed (${res.status})` };
  const json: any = await res.json();
  const list = Array.isArray(json) ? json : json.voices ?? json.data ?? [];
  return { voices: list.map((v: any) => ({ name: String(v.name ?? v.id ?? v) })), error: null };
});

export const yarnStartTts = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ text: z.string().min(1).max(500), voice: z.string().min(1).max(40) }).parse(d))
  .handler(async ({ data }) => {
    const res = await fetch(`${BASE}/tts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key()}`,
        "Content-Type": "application/json",
        "Idempotency-Key": crypto.randomUUID(),
      },
      body: JSON.stringify({ text: data.text, voice: data.voice, output_format: "mp3" }),
    });
    const body: any = await res.json().catch(() => ({}));
    if (!res.ok) return { jobId: null, error: body?.error?.message ?? body?.message ?? `TTS failed (${res.status})` };
    return { jobId: String(body.job_id), error: null };
  });

export const yarnJobStatus = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ jobId: z.string().regex(/^[\w-]{1,100}$/) }).parse(d))
  .handler(async ({ data }) => {
    const res = await fetch(`${BASE}/status/${data.jobId}`, { headers: { Authorization: `Bearer ${key()}` } });
    const body: any = await res.json().catch(() => ({}));
    if (!res.ok) return { status: "failed", audioUrl: null, error: `Status failed (${res.status})` };
    return { status: String(body.status), audioUrl: (body.audio_url as string) ?? null, error: body.error?.message ?? null };
  });
