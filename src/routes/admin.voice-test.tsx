import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { yarnJobStatus, yarnListVoices, yarnStartTts } from "@/lib/yarngpt.functions";

const SAMPLES: Record<string, string> = {
  "Nigerian English": "Good afternoon, welcome to Kindred Bank. How may I help you today?",
  Pidgin: "How far! Welcome to Kindred Bank. Wetin I fit do for you today?",
  Yoruba: "Ẹ káàsán, ẹ kú àbọ̀ sí Kindred Bank. Báwo ni mo ṣe lè ràn yín lọ́wọ́?",
  Hausa: "Barka da rana, barka da zuwa Kindred Bank. Yaya zan iya taimaka maka?",
  Igbo: "Ehihie ọma, nnọọ na Kindred Bank. Kedu ka m ga-esi nyere gị aka?",
};

export const Route = createFileRoute("/admin/voice-test")({
  head: () => ({ meta: [{ title: "YarnGPT voice test — Kindred Bank" }, { name: "description", content: "Test Nigerian voices." }] }),
  component: VoiceTest,
});

function VoiceTest() {
  const list = useServerFn(yarnListVoices);
  const start = useServerFn(yarnStartTts);
  const status = useServerFn(yarnJobStatus);
  const [voices, setVoices] = useState<string[]>(["idera"]);
  const [voice, setVoice] = useState("idera");
  const [text, setText] = useState(SAMPLES["Nigerian English"]);
  const [state, setState] = useState("");
  const [audio, setAudio] = useState<string | null>(null);

  useEffect(() => {
    list().then((r) => { if (r.voices.length) { setVoices(r.voices.map((v: { name: string }) => v.name)); setVoice(r.voices[0].name); } });
  }, []);

  async function run() {
    setAudio(null); setState("Queuing…");
    const r = await start({ data: { text, voice } });
    if (!r.jobId) return setState(r.error ?? "Failed");
    for (let i = 0; i < 60; i++) {
      await new Promise((ok) => setTimeout(ok, 1500));
      const s = await status({ data: { jobId: r.jobId } });
      setState(`Status: ${s.status}`);
      if (s.status === "completed" && s.audioUrl) { setAudio(s.audioUrl); new Audio(s.audioUrl).play().catch(() => {}); return; }
      if (s.status === "failed" || s.error) return setState(s.error ?? "Job failed");
    }
    setState("Timed out");
  }

  return (
    <div className="mx-auto max-w-xl space-y-4 p-6">
      <h1 className="text-2xl font-semibold text-primary">YarnGPT voice test</h1>
      <div className="flex flex-wrap gap-2">
        {Object.keys(SAMPLES).map((k) => (
          <button key={k} onClick={() => setText(SAMPLES[k])} className="rounded-md border border-border px-3 py-1 text-sm">{k}</button>
        ))}
      </div>
      <select value={voice} onChange={(e) => setVoice(e.target.value)} className="w-full rounded-md border border-border bg-background p-2">
        {voices.map((v) => <option key={v}>{v}</option>)}
      </select>
      <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={500} rows={4} className="w-full rounded-md border border-border bg-background p-2" />
      <button onClick={run} className="rounded-md bg-primary px-4 py-2 text-primary-foreground">Speak</button>
      <p className="text-sm text-muted-foreground">{state}</p>
      {audio && <audio src={audio} controls autoPlay className="w-full" />}
    </div>
  );
}
