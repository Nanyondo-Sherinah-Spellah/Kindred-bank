import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { auditionNigerianVoice } from "@/lib/cs.functions";
import { Mic, MicOff, PhoneCall, PhoneOff, Play } from "lucide-react";
import { useLiveVoice } from "@/hooks/use-live-voice";
import { Button } from "@/components/ui/button";
import { LANG_LABEL, type Lang } from "@/lib/lang";

export function LiveBankVoice({ session, language, onReply }: { session: { sessionId: string; token: string }; language: Lang; onReply: (reply: string) => void }) {
  const [captions, setCaptions] = useState("");
  const [seconds, setSeconds] = useState(0);
  const audition = useServerFn(auditionNigerianVoice);
  const [sample, setSample] = useState<string | null>(null);
  const [sampleBusy, setSampleBusy] = useState(false);
  const [sampleError, setSampleError] = useState("");
  const sampleAudio = useRef<HTMLAudioElement>(null);
  useEffect(() => () => { if (sample) URL.revokeObjectURL(sample); }, [sample]);
  async function previewVoice() {
    setSampleBusy(true); setSampleError("");
    try {
      const result = await audition({ data: session });
      const bytes = Uint8Array.from(atob(result.base64), (c) => c.charCodeAt(0));
      setSample(URL.createObjectURL(new Blob([bytes], { type: result.mime })));
    } catch { setSampleError("Could not generate the voice sample. Please try again."); }
    finally { setSampleBusy(false); }
  }
  const call = useLiveVoice({ capability: session, onEvent: (event) => {
    const delta = event["delta"];
    const plan = event["plan"];
    if (event.type === "session.output_transcript.delta" && typeof delta === "string") setCaptions((text) => (text + delta).slice(-2000));
    if (event.type === "app.bank.reply" && plan && typeof plan === "object" && "reply" in plan && typeof plan.reply === "string") onReply(plan.reply);
    if (typeof event.usage?.seconds === "number") setSeconds(event.usage.seconds);
  } });
  const active = call.status === "connected" || call.status === "connecting";
  return <section aria-label="AI voice audition" className="space-y-3 border-y py-3">
    <p className="text-sm font-semibold">AI voice · {LANG_LABEL[language]}</p>
    <p className="text-xs text-muted-foreground">AI-generated voice. Native pronunciation is not guaranteed. Voice calls use AI credits, including a 15-second minimum.</p>
    <audio ref={call.audioRef} controls className="w-full" />
    <Button variant="outline" disabled={sampleBusy || active} onClick={previewVoice}><Play className="h-4 w-4" />{sampleBusy ? "Preparing voice…" : "Audition greeting"}</Button>
    {sample && <audio ref={sampleAudio} aria-label="Nigerian-language voice sample" src={sample} controls className="w-full" />}
    {sampleError && <p role="alert" className="text-sm text-destructive">{sampleError}</p>}
    <div className="flex flex-wrap gap-2">
      {active ? <Button onClick={call.stop} variant="outline"><PhoneOff className="h-4 w-4" />Stop voice</Button> : <Button onClick={call.start}><PhoneCall className="h-4 w-4" />Start AI voice</Button>}
      {active && <Button size="icon" variant="outline" aria-label={call.muted ? "Unmute microphone" : "Mute microphone"} title={call.muted ? "Unmute microphone" : "Mute microphone"} onClick={() => call.setMuted(!call.muted)}>{call.muted ? <MicOff /> : <Mic />}</Button>}
      {call.playbackBlocked && <Button onClick={call.resumePlayback}><Play />Play voice</Button>}
    </div>
    <p className="text-xs text-muted-foreground">{call.status}{seconds > 0 ? ` · ${Math.max(15, seconds).toFixed(0)} billable voice seconds` : ""}</p>
    {captions && <p role="log" aria-label="Spoken captions" className="max-h-32 overflow-y-auto break-words text-sm">{captions}</p>}
    {call.error && <p role="alert" className="text-sm text-destructive">{call.error}</p>}
  </section>;
}