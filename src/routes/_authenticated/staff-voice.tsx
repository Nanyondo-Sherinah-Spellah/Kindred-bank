import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Mic, MicOff, PhoneCall, PhoneOff, Send, LifeBuoy, Volume2, VolumeX, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getVoiceSuggestions, voiceEnd, voiceEscalate, voiceStart, voiceTurn } from "@/lib/cs.functions";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState, fmt, PageHeader, StatusPill } from "@/components/common";
import { useIntegrations } from "@/components/integration-banner";

export const Route = createFileRoute("/_authenticated/staff-voice")({
  head: () => ({ meta: [{ title: "Voice Assistant — Kindred Bank" }, { name: "description", content: "In-browser voice assistant demonstration with verification." }, { property: "og:title", content: "Voice Assistant — Kindred Bank" }, { property: "og:description", content: "In-browser voice assistant demonstration with verification." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: VoicePage,
});

type Msg = { role: "assistant" | "customer"; text: string };
type SR = { start(): void; stop(): void; lang: string; interimResults: boolean; onresult: ((e: any) => void) | null; onend: (() => void) | null; onerror: ((e: any) => void) | null };

function VoicePage() {
  const qc = useQueryClient();
  const integ = useIntegrations();
  const start = useServerFn(voiceStart);
  const turn = useServerFn(voiceTurn);
  const escalate = useServerFn(voiceEscalate);
  const end = useServerFn(voiceEnd);
  const suggestions = useServerFn(getVoiceSuggestions);
  const [language, setLanguage] = useState<"en" | "pcm" | null>(null);
  const { data: questions, isError: questionsError } = useQuery({ queryKey: ["voice-suggestions"], queryFn: () => suggestions() });
  const [session, setSession] = useState<{ id: string; ref: string } | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [speak, setSpeak] = useState(true);
  const [awaiting, setAwaiting] = useState(false);
  const [verified, setVerified] = useState(false);
  const [support, setSupport] = useState({ stt: false, tts: false });
  const recRef = useRef<SR | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const w = window as any;
    setSupport({ stt: Boolean(w.SpeechRecognition || w.webkitSpeechRecognition), tts: "speechSynthesis" in window });
  }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  const { data: history } = useQuery({
    queryKey: ["voice_sessions"],
    queryFn: async () => (await supabase.from("voice_sessions").select("id, case_reference, status, verified_customer_email, created_at, transcript").order("created_at", { ascending: false }).limit(20)).data ?? [],
  });

  // Prefer a Nigerian voice; keep the same one for the whole conversation.
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const [voiceName, setVoiceName] = useState<string | null>(null);
  const [langCode, setLangCode] = useState("en-NG");
  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    const pick = () => {
      const vs = window.speechSynthesis.getVoices();
      const v = vs.find((x) => /en[-_]NG/i.test(x.lang)) ?? null;
      voiceRef.current = v;
      setVoiceName(v ? `${v.name} (${v.lang})` : null);
    };
    pick();
    window.speechSynthesis.addEventListener("voiceschanged", pick);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", pick);
  }, []);
  const BCP: Record<string, string> = { en: "en-NG", pcm: "en-NG", yo: "yo-NG", ig: "ig-NG", ha: "ha-NG" };

  function say(t: string) {
    if (!speak || !support.tts) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(t);
    u.lang = "en-NG";
    if (voiceRef.current) u.voice = voiceRef.current;
    u.rate = 0.95;
    window.speechSynthesis.speak(u);
  }

  async function begin() {
    if (!language) return;
    setBusy(true);
    try {
      const r = await start({ data: { language } });
      setSession({ id: r.sessionId, ref: r.caseReference });
      setMsgs([{ role: "assistant", text: r.reply }]);
      setAwaiting(false); setVerified(false);
      say(r.reply);
      qc.invalidateQueries({ queryKey: ["voice_sessions"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not start"); } finally { setBusy(false); }
  }

  async function send(t: string) {
    if (!session || busy || !t.trim()) return;
    setMsgs((m) => [...m, { role: "customer", text: t }]);
    setText("");
    setBusy(true);
    try {
      const r = await turn({ data: { sessionId: session.id, text: t } });
      setMsgs((m) => [...m, { role: "assistant", text: r.reply }]);
      setAwaiting(r.awaitingVerification); setVerified(r.verified);
      setLangCode(BCP[r.language] ?? "en-NG");
      if (r.escalated) qc.invalidateQueries({ queryKey: ["open-escalations-count"] });
      say(r.reply);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); } finally { setBusy(false); qc.invalidateQueries({ queryKey: ["voice_sessions"] }); }
  }

  function toggleMic() {
    const w = window as any;
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) { toast.error("Speech recognition isn't available in this browser. Use the text box instead."); return; }
    if (listening) { recRef.current?.stop(); return; }
    const rec: SR = new Ctor();
    rec.lang = langCode;
    rec.interimResults = false;
    rec.onresult = (e) => { const t = e.results[0][0].transcript as string; send(t); };
    rec.onerror = (e) => { toast.error(`Microphone: ${e.error ?? "error"}`); };
    rec.onend = () => setListening(false);
    recRef.current = rec;
    window.speechSynthesis?.cancel();
    rec.start();
    setListening(true);
  }

  async function hangup() {
    if (!session) return;
    await end({ data: { sessionId: session.id } }).catch(() => {});
    window.speechSynthesis?.cancel();
    recRef.current?.stop();
    setSession(null);
    setLanguage(null);
    qc.invalidateQueries({ queryKey: ["voice_sessions"] });
  }
  async function toHuman() {
    if (!session) return;
    try {
      const r = await escalate({ data: { sessionId: session.id } });
      setMsgs((m) => [...m, { role: "assistant", text: r.reply }]);
      say(r.reply);
      toast.success("Escalated to human support");
      setSession(null);
      qc.invalidateQueries({ queryKey: ["open-escalations-count"] });
      qc.invalidateQueries({ queryKey: ["voice_sessions"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  }

  return (
    <>
      <PageHeader title="Voice Assistant" description="Answers general questions from the knowledge base and verifies callers on the server before sharing demonstration repayment details." />
      <div className="mb-4 rounded-md border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
        <strong>In-browser voice demonstration — not a live telephone line.</strong>{" "}
        {integ.data?.voiceProvider ? "Telephone provider credentials are present but call routing is not enabled in this build." : "No telephone provider is connected."}{" "}
        Demo verification codes are placeholders, not production-grade identity checks.
        <br />
        <strong>Voice:</strong>{" "}
        {voiceName
          ? `Using the Nigerian English voice ${voiceName}.`
          : "This browser has no Nigerian English voice installed, so speech uses its default English voice. Spoken replies in Yoruba, Igbo and Hausa are read with that voice and will not sound native. A natural Nigerian voice needs a voice provider (for example ElevenLabs) to be connected."}{" "}
        Speech recognition listens in {langCode}; Yoruba, Igbo and Hausa recognition depends on browser support — typing always works.
      </div>
      <div className="grid min-w-0 gap-4 sm:gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="flex min-h-[400px] min-w-0 flex-col sm:min-h-[560px]">
          <CardHeader className="flex-row flex-wrap items-center gap-2 space-y-0 border-b">
            <CardTitle className="text-base">Conversation</CardTitle>
            {session && <span className="font-mono text-xs text-muted-foreground">{session.ref}</span>}
            {awaiting && <StatusPill label="awaiting verification" kind="warn" />}
            {verified && <StatusPill label="caller verified (demo)" kind="good" />}
            <Button variant="ghost" size="icon" className="ml-auto" onClick={() => { setSpeak(!speak); window.speechSynthesis?.cancel(); }} aria-label="Toggle speech output" disabled={!support.tts}>
              {speak && support.tts ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </Button>
          </CardHeader>
          <CardContent className="max-h-[50svh] min-w-0 flex-1 space-y-3 overflow-auto p-3 sm:p-4">
            {!session ? <div className="space-y-5 py-6">
              <h2 className="text-lg font-semibold">Choose your preferred language</h2>
              <RadioGroup value={language ?? ""} onValueChange={(value) => { if (value === "en" || value === "pcm") setLanguage(value); }} className="grid gap-3 sm:grid-cols-2" aria-label="Preferred language">
                <div className="flex items-center gap-3 rounded-md border p-4"><RadioGroupItem value="en" id="voice-en" /><Label htmlFor="voice-en">English</Label></div>
                <div className="flex items-center gap-3 rounded-md border p-4"><RadioGroupItem value="pcm" id="voice-pcm" /><Label htmlFor="voice-pcm">Pidgin English</Label></div>
              </RadioGroup>
            </div> : null}
            {msgs.length === 0 && session ? <EmptyState title="No active call" icon={<PhoneCall className="h-8 w-8" />} /> :
              msgs.map((m, i) => (
                <div key={i} className={`flex ${m.role === "customer" ? "justify-end" : ""}`}>
                  <div className={`max-w-[90%] break-words rounded-lg sm:max-w-[80%] px-3.5 py-2 text-sm ${m.role === "customer" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{m.text}</div>
                </div>
              ))}
            {busy && session && <div className="text-xs text-muted-foreground">Assistant is thinking…</div>}
            <div ref={endRef} />
          </CardContent>
          {session && language && !awaiting && <section className="space-y-2 border-t p-3" aria-label="Suggested questions">
            <h3 className="text-sm font-semibold">{language === "pcm" ? "Wetin you wan ask?" : "Suggested questions"}</h3>
            {questionsError ? <p className="text-sm text-destructive">Suggested questions could not be loaded.</p> : <div className="grid max-h-48 gap-2 overflow-y-auto sm:grid-cols-2">
              {(questions ?? []).filter((q) => q.language === language).map((q) => <Button key={q.id} variant="outline" className="h-auto min-h-11 justify-start whitespace-normal text-left text-xs" disabled={busy} onClick={() => send(q.question)}>{q.question}</Button>)}
            </div>}
          </section>}
          <div className="space-y-2 border-t p-3">
            {!session ? (
              <Button onClick={begin} disabled={busy || !language} className="w-full"><PhoneCall className="mr-2 h-4 w-4" />Start voice session</Button>
            ) : (
              <>
                <form onSubmit={(e) => { e.preventDefault(); send(text); }} className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-2">
                  <Button type="button" variant={listening ? "destructive" : "secondary"} size="icon" onClick={toggleMic} disabled={!support.stt || busy} aria-label="Microphone">
                    {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  </Button>
                  <Input className="min-w-0" value={text} onChange={(e) => setText(e.target.value)} placeholder={awaiting ? "Enter demo verification code…" : listening ? "Listening…" : "Type a message (text fallback)"} maxLength={1000} />
                  <Button type="submit" size="icon" disabled={busy || !text.trim()} aria-label="Send"><Send className="h-4 w-4" /></Button>
                </form>
                <div className="grid gap-2 sm:flex sm:flex-wrap">
                  <Button variant="outline" size="sm" onClick={toHuman}><LifeBuoy className="mr-2 h-3.5 w-3.5" />Escalate to human</Button>
                  <Button variant="ghost" size="sm" onClick={hangup}><PhoneOff className="mr-2 h-3.5 w-3.5" />End session</Button>
                </div>
                {!support.stt && <p className="text-xs text-muted-foreground">Microphone input isn't supported in this browser — the text box works the same way.</p>}
              </>
            )}
          </div>
        </Card>
        <Card className="min-w-0 break-words">
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4 text-teal" />Voice history</CardTitle></CardHeader>
          <CardContent>
            {!history?.length ? <EmptyState title="No sessions yet" /> : (
              <ul className="divide-y text-sm">
                {history.map((h) => (
                  <li key={h.id} className="py-2.5">
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2"><span className="break-all font-mono text-xs">{h.case_reference}</span><StatusPill label={h.status} kind={h.status === "escalated" ? "bad" : h.status === "active" ? "info" : "muted"} /></div>
                    <div className="text-xs text-muted-foreground">{fmt(h.created_at)} · {(h.transcript as unknown[]).length} turns{h.verified_customer_email ? ` · verified ${h.verified_customer_email}` : ""}</div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
