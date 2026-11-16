import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { MessageCircle, Mic, MicOff, PhoneCall, PhoneOff, Send, LifeBuoy, Volume2, VolumeX } from "lucide-react";
import { publicVoiceStart, publicVoiceTurn, publicVoiceReplyStream, publicVoiceClose, publicVoiceFeedback, publicCustomerWelcome } from "@/lib/cs.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { isKnownFemaleVoice, isNigerianVoice, preferredBrowserVoice } from "@/lib/browser-voice";
import { AccountOpeningForm } from "@/components/account-opening-form";
import { offeredOpenableProduct } from "@/lib/account-opening";
import { Checkbox } from "@/components/ui/checkbox";
import { LANGS, LANG_LABEL, type Lang } from "@/lib/lang";
import { LANGUAGE_LOCALE, SATISFACTION, FEEDBACK_LABELS, SUGGESTION_LABELS, feedbackAnswer } from "@/lib/conversation-language";
import { LiveBankVoice } from "@/components/live-bank-voice";
import { questionsInLanguage } from "@/lib/suggested-questions";
import { playYarn, stopYarn, yarnSpeechQueue } from "@/lib/yarngpt-play";
import { readVoiceReply, questionReadBack } from "@/lib/voice-reply-stream";
import { parseCustomerCredentials } from "@/lib/customer-conversation";
import { parseBalanceCredentials } from "@/lib/public-voice-policy";

type Recognition = { lang: string; interimResults: boolean; start(): void; stop(): void; onresult: ((event: { results: { transcript: string }[][] }) => void) | null; onend: (() => void) | null; onerror: (() => void) | null };
type SpeechWindow = Window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
type Session = Awaited<ReturnType<typeof publicVoiceStart>>;
const CATEGORIES = ["Products (Savings)", "Products (Loan)", "Bank profile, Contact and Hours", "Fees, Cards & Tiers", "Policies", "Complaints"];

export function PublicVoiceChat({ onEngage, mode = "voice" }: { onEngage?: (engaged: boolean) => void; mode?: "voice" | "chat" } = {}) {
  const isChat = mode === "chat";
  const start = useServerFn(publicVoiceStart);
  const turn = useServerFn(publicVoiceTurn);
  const streamTurn = useServerFn(publicVoiceReplyStream);
  const close = useServerFn(publicVoiceClose);
  const feedbackFn = useServerFn(publicVoiceFeedback);
  const welcome = useServerFn(publicCustomerWelcome);
  const [existing, setExisting] = useState(false);
  const [remember, setRemember] = useState(false);
  const [firstName, setFirstName] = useState<string | null>(null);
  const [identity, setIdentity] = useState("");
  const [code, setCode] = useState("");
  const [awaitingIdentity, setAwaitingIdentity] = useState(false);
  useEffect(() => {
    void welcome({ data: { forget: false } }).then((r) => { setFirstName(r.firstName); if (r.firstName) { setExisting(true); setRemember(true); } }).catch(() => {});
  }, [welcome]);
  const [language, setLanguage] = useState<Lang | null>(null);
  const aiVoice = language === "ha" || language === "ig" || language === "yo";
  const [session, setSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<{ role: "assistant" | "customer"; text: string }[]>([]);
  const [text, setText] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<"ask" | "options" | null>(null);
  const [opening, setOpening] = useState(false);
  const [openProduct, setOpenProduct] = useState<string | undefined>();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [listening, setListening] = useState(false);
  const [speech, setSpeech] = useState(mode !== "chat");
  const [micAvailable, setMicAvailable] = useState(false);
  const [voiceDescription, setVoiceDescription] = useState("No female Nigerian voice is available in this browser. Speech uses the browser's default voice; a Nigerian or native Pidgin accent is not guaranteed.");
  const recognition = useRef<Recognition | null>(null);
  const voice = useRef<SpeechSynthesisVoice | null>(null);
  const conversation = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const w = window as SpeechWindow;
    setMicAvailable(Boolean(w.SpeechRecognition || w.webkitSpeechRecognition));
    if (!("speechSynthesis" in window)) return;
    const pick = () => {
      if (voice.current) return;
      voice.current = preferredBrowserVoice(window.speechSynthesis.getVoices());
      if (!voice.current) return;
      const selected = voice.current;
      setVoiceDescription(isNigerianVoice(selected)
        ? `${isKnownFemaleVoice(selected) ? "Female Nigerian English" : "Nigerian English (female voice unavailable)"} voice: ${selected.name}. A native Pidgin accent is not guaranteed.`
        : `${isKnownFemaleVoice(selected) ? "Female English" : "English"} voice: ${selected.name}. No female Nigerian voice is available in this browser; this voice does not guarantee a Nigerian or native Pidgin accent.`);
    };
    pick();
    window.speechSynthesis.addEventListener("voiceschanged", pick);
    return () => { recognition.current?.stop(); stopYarn(); window.speechSynthesis.cancel(); window.speechSynthesis.removeEventListener("voiceschanged", pick); };
  }, []);
  useEffect(() => { if (conversation.current) conversation.current.scrollTop = conversation.current.scrollHeight; }, [messages]);
  function say(reply: string) {
    if (isChat || !speech || !language) return;
    window.speechSynthesis?.cancel();
    void playYarn(reply, language).then((ok) => ok || playYarn(reply, language)).then((ok) => { if (!ok && language === "en") browserSay(reply); });
  }
  function browserSay(reply: string) {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(reply);
    utterance.lang = voice.current?.lang ?? "en-NG"; utterance.rate = 0.95;
    if (voice.current) utterance.voice = voice.current;
    window.speechSynthesis.speak(utterance);
  }
  async function begin() {
    if (!language || busy) return;
    setBusy(true); setError("");
    try {
      const r = await start({ data: { language, existing, mode } });
      setSession(r); setAwaitingIdentity(existing); setMessages([{ role: "assistant", text: r.reply }]); say(r.reply); onEngage?.(true);
    } catch { setError("Voice support could not start. Please try again."); }
    finally { setBusy(false); }
  }
  async function send(value: string, selected = false) {
    if (!session || busy || !value.trim()) return;
    const plain = value.trim().toLowerCase().replace(/[.!]+$/, "");
    const answer = feedbackAnswer(plain);
    if (answer === false || (feedback === "ask" && answer === true)) { setText(""); void answerFeedback(answer, value.trim()); return; }
    setBusy(true); setError(""); recognition.current?.stop();
    try {
      if (!isChat && speech && language && aiVoice && !parseCustomerCredentials(value) && !parseBalanceCredentials(value)) {
        const startedAt = performance.now();
        window.speechSynthesis?.cancel();
        const queue = yarnSpeechQueue(language, () => console.info("Voice audio started", { language, milliseconds: Math.round(performance.now() - startedAt) }));
        const readBack = questionReadBack(value);
        if (readBack) queue.append(readBack);
        const safeValue = value.replace(/\d/g, "•");
        setMessages((m) => [...m, { role: "customer", text: safeValue }, { role: "assistant", text: "" }]);
        let partial = "";
        let complete = false;
        let streamError = "";
        const response = await streamTurn({ data: { sessionId: session.sessionId, token: session.token, text: value } });
        await readVoiceReply(response, (event) => {
          if (event.type === "chunk") {
            partial = `${partial} ${event.text}`.trim();
            setMessages((m) => [...m.slice(0, -1), { role: "assistant", text: partial }]);
            queue.append(event.text);
          } else if (event.type === "done") {
            complete = true;
            setAwaitingIdentity(event.action === "verify");
            const ask = event.action === "answer" ? SATISFACTION[language] : null;
            setMessages((m) => [...m.slice(0, -1), { role: "assistant", text: event.reply }, ...(ask ? [{ role: "assistant" as const, text: ask }] : [])]);
            if (ask) queue.append(ask);
            setFeedback(ask ? "ask" : null);
            if (event.action === "account_opening") { setOpening(true); onEngage?.(true); }
          } else streamError = event.message;
        });
        void queue.finished().then((ok) => { if (!ok) setError("The voice could not play. You can read the reply or try again."); });
        if (!complete) throw new Error(streamError || "Incomplete reply");
        setText(""); setCode(""); setIdentity("");
        return;
      }
      const r = await turn({ data: { sessionId: session.sessionId, token: session.token, text: value, remember } });
      setAwaitingIdentity(r.action === "verify");
      const safeValue = value.replace(/\d/g, "•");
      const ask = r.action === "answer" ? SATISFACTION[language ?? "en"] : null;
      if (r.action === "account_opening") { setOpening(true); onEngage?.(true); }
      setMessages((m) => [...m, { role: "customer", text: safeValue }, { role: "assistant", text: r.reply }, ...(ask ? [{ role: "assistant" as const, text: ask }] : [])]); setText(""); setCode(""); setIdentity("");
      const safeQuestion = questionReadBack(value);
      const readBack = safeQuestion ? `${safeQuestion}. ` : "";
      say(`${readBack}${ask ? `${r.reply} ${ask}` : r.reply}`);
      setFeedback(ask ? "ask" : null);
    } catch { setText(value); setError("Your message could not be completed. Please try again or start a new conversation."); }
    finally { setBusy(false); }
  }
  async function answerFeedback(yes: boolean, typed?: string) {
    if (!session || busy) return;
    setBusy(true); setError("");
    try {
      const { reply } = await feedbackFn({ data: { sessionId: session.sessionId, token: session.token, satisfied: yes } });
      setMessages((m) => [...m, { role: "customer", text: typed ?? FEEDBACK_LABELS[language ?? "en"][yes ? "yes" : "no"] }, { role: "assistant", text: reply }]); say(reply);
      setFeedback(yes ? null : "options");
    } catch { setError("Could not save your feedback. Please try again."); }
    finally { setBusy(false); }
  }
  function toggleMic() {
    if (listening) { recognition.current?.stop(); return; }
    const w = window as SpeechWindow;
    const Constructor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Constructor) return;
    const rec = new Constructor(); rec.lang = LANGUAGE_LOCALE[language ?? "en"]; rec.interimResults = false;
    rec.onresult = (event) => { const value = event.results[0]?.[0]?.transcript; if (value) void send(value); };
    rec.onend = () => setListening(false);
    rec.onerror = () => { setListening(false); setError("Microphone unavailable. You can type your question below."); };
    recognition.current = rec; stopYarn(); window.speechSynthesis?.cancel();
    try { rec.start(); setListening(true); } catch { setError("Microphone unavailable. You can type your question below."); }
  }
  async function finish(escalate: boolean) {
    if (!session || busy) return;
    setBusy(true); setError("");
    try {
      const r = await close({ data: { sessionId: session.sessionId, token: session.token, escalate } });
      recognition.current?.stop(); window.speechSynthesis?.cancel();
      setMessages((m) => [...m, { role: "assistant", text: r.reply }]); setSession(null); setLanguage(null); setCategory(null); setFeedback(null); say(r.reply);
    } catch { setError("Could not end the conversation. Please try again."); }
    finally { setBusy(false); }
  }
  const latest = [...messages].reverse().find((m) => m.role === "assistant" && !Object.values(SATISFACTION).includes(m.text))?.text;
  const suggestionLabels = SUGGESTION_LABELS[language ?? "en"];
  return <div className="min-w-0 space-y-4">
    <p className="text-xs text-muted-foreground">{isChat ? "Text chat support." : "In-browser voice support, not a live phone line."} Conversations are saved for support review. Never share PINs, OTPs or passwords.</p>
    {!session && <div className="space-y-4">
      {firstName && <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold">Welcome back, {firstName}!</p><Button variant="ghost" size="sm" onClick={async () => { try { await welcome({ data: { forget: true } }); setFirstName(null); setExisting(false); setRemember(false); } catch { setError("Could not forget this device. Try again."); } }}>Not you? Forget this device</Button></div>}
      <RadioGroup aria-label="Customer type" value={existing ? "customer" : "visitor"} onValueChange={(v) => setExisting(v === "customer")} className="grid gap-3 sm:grid-cols-2">
        <div className="flex items-center gap-3 rounded-md border p-3"><RadioGroupItem value="customer" id="existing-customer" /><Label htmlFor="existing-customer">Existing customer</Label></div>
        <div className="flex items-center gap-3 rounded-md border p-3"><RadioGroupItem value="visitor" id="new-visitor" /><Label htmlFor="new-visitor">Continue as visitor</Label></div>
      </RadioGroup>
      <h2 className="font-semibold">Choose your preferred language</h2>
      <RadioGroup aria-label="Preferred language" value={language ?? ""} onValueChange={(v) => { const selected = LANGS.find((l) => l === v); if (selected) setLanguage(selected); }} className="grid gap-3 sm:grid-cols-2">
        {LANGS.map((lang) => <div key={lang} className="flex items-center gap-3 rounded-md border p-4"><RadioGroupItem value={lang} id={`public-${lang}`} /><Label htmlFor={`public-${lang}`}>{lang === "pcm" ? "Pidgin English" : LANG_LABEL[lang]}</Label></div>)}
      </RadioGroup>
      <Button className="w-full" onClick={begin} disabled={!language || busy}>{isChat ? <MessageCircle className="mr-2 h-4 w-4" /> : <PhoneCall className="mr-2 h-4 w-4" />}{busy ? "Starting…" : isChat ? "Start chat" : "Start voice session"}</Button>
    </div>}
    {session && latest && <section aria-label="Current response" className="rounded-md border border-primary/40 bg-secondary p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-primary">Current response</p>
      <p className="mt-1 break-words text-sm text-foreground">{busy ? "One moment…" : latest}</p>
      {!busy && feedback === "ask" && <div className="mt-3 flex gap-2"><Button size="sm" onClick={() => answerFeedback(true)}>{FEEDBACK_LABELS[language ?? "en"].yes}</Button><Button size="sm" variant="outline" onClick={() => answerFeedback(false)}>{FEEDBACK_LABELS[language ?? "en"].no}</Button></div>}
      {!busy && feedback === "options" && <div className="mt-3 flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => { setFeedback(null); input.current?.focus(); }}>Ask another way</Button><Button size="sm" onClick={() => finish(true)}><LifeBuoy className="mr-2 h-4 w-4" />Talk to a person</Button></div>}
      {!busy && feedback === "options" && session && <div className="mt-3 space-y-2">
        <p className="text-xs font-semibold text-foreground">{suggestionLabels.more}</p>
        <div className="grid gap-2">{session.questions.filter((q) => q.language === language && !messages.some((m) => m.role === "customer" && m.text === q.question)).slice(0, 5).map((q) => <Button key={q.id} size="sm" variant="outline" className="h-auto min-h-9 justify-start whitespace-normal text-left text-xs" onClick={() => { setFeedback(null); void send(q.question); }}>{q.question}</Button>)}</div>
      </div>}
    </section>}
    {messages.length > 0 && <div ref={conversation} role="log" aria-label={isChat ? "Chat conversation" : "Voice conversation"} aria-live="polite" className="max-h-[40svh] space-y-3 overflow-y-auto rounded-md border p-3">
      {messages.map((m, i) => <div key={i} className={`flex ${m.role === "customer" ? "justify-end" : ""}`}><p className={`max-w-[90%] break-words rounded-md px-3 py-2 text-sm ${m.role === "customer" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{m.text}</p></div>)}
      {busy && <p className="text-sm text-muted-foreground">One moment…</p>}
    </div>}
    {session && <>
      {!isChat && aiVoice && language && <LiveBankVoice session={session} language={language} onReply={(reply) => { setMessages((m) => [...m, { role: "assistant", text: reply }]); }} />}
      {awaitingIdentity && <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void send(`${identity} code ${code}`); }}>
        <div className="space-y-1"><Label htmlFor="customer-identity">Account number or registered phone number</Label><Input id="customer-identity" inputMode="numeric" autoComplete="off" maxLength={15} value={identity} onChange={(e) => setIdentity(e.target.value.replace(/[^\d+]/g, ""))} /></div>
        <div className="space-y-1"><Label htmlFor="customer-code">4-digit verification code</Label><Input id="customer-code" type="password" inputMode="numeric" autoComplete="off" maxLength={4} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} /></div>
        <div className="flex items-center gap-2"><Checkbox id="remember-customer" checked={remember} onCheckedChange={(v) => setRemember(v === true)} /><Label htmlFor="remember-customer">Remember me on this device</Label></div>
        <p className="text-xs text-muted-foreground">Use only on your own device. Returning greetings last 30 days; account access still requires verification.</p>
        <Button className="w-full" disabled={busy || identity.replace(/\D/g, "").length < 10 || code.length !== 4}>Verify customer</Button>
      </form>}
      <section aria-label="Suggested questions" className="space-y-2">
        <h3 className="text-sm font-semibold">{suggestionLabels.choose}</h3>
        <div role="group" aria-label="Request category" className="flex flex-wrap gap-2">{CATEGORIES.map((c, i) => <Button key={c} size="sm" type="button" variant={category === c ? "default" : "outline"} aria-pressed={category === c} onClick={() => setCategory(category === c ? null : c)} className="h-auto min-h-9 whitespace-normal text-xs">{suggestionLabels.categories[i]}</Button>)}</div>
        {category && <h3 className="pt-1 text-sm font-semibold">{suggestionLabels.questions}</h3>}
         {category && <div className="grid max-h-44 gap-2 overflow-y-auto sm:grid-cols-2">{questionsInLanguage(session.questions, language ?? "en", category).map((q) => <Button key={q.id} onClick={() => send(q.question, true)} disabled={busy} variant="outline" className="h-auto min-h-11 whitespace-normal text-left text-xs">{q.question}</Button>)}</div>}
      </section>
      <form className={`grid gap-2 ${isChat ? "grid-cols-[minmax(0,1fr)_auto]" : "grid-cols-[auto_minmax(0,1fr)_auto]"}`} onSubmit={(e) => { e.preventDefault(); void send(text); }}>
        {!isChat && !aiVoice && <Button aria-label="Microphone" title="Microphone" type="button" size="icon" variant={listening ? "destructive" : "secondary"} disabled={!micAvailable || busy} onClick={toggleMic}>{listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}</Button>}
        <Input ref={input} aria-label="Your question" placeholder={listening ? "Listening…" : "Type your question…"} className="min-w-0" maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} />
        <Button aria-label="Send" title="Send" size="icon" disabled={!text.trim() || busy}><Send className="h-4 w-4" /></Button>
      </form>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" disabled={busy} onClick={() => finish(true)}><LifeBuoy className="mr-2 h-4 w-4" />Human support</Button>
        <Button variant="ghost" size="sm" disabled={busy} onClick={() => finish(false)}><PhoneOff className="mr-2 h-4 w-4" />{isChat ? "End chat" : "End session"}</Button>
        {!isChat && !aiVoice && <Button aria-label="Toggle speech output" title="Toggle speech output" size="icon" variant="ghost" onClick={() => { setSpeech(!speech); stopYarn(); window.speechSynthesis?.cancel(); }}>{speech ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}</Button>}
      </div>
      <p className="break-all text-xs text-muted-foreground">{session.caseReference}</p>
    </>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {!opening && offeredOpenableProduct(latest) && (
      <Button className="w-full" onClick={() => { setOpenProduct(offeredOpenableProduct(latest) ?? undefined); setOpening(true); onEngage?.(true); }}>Yes, open a {offeredOpenableProduct(latest)} account</Button>
    )}
    <Button variant="outline" className="w-full" onClick={() => { setOpenProduct(undefined); setOpening(!opening); onEngage?.(true); }}> {opening ? "Return to conversation" : "Open an account"}</Button>
    {opening && <AccountOpeningForm key={openProduct ?? "default"} channel={isChat ? "chat" : "voice"} {...(openProduct ? { initialProduct: openProduct } : {})} />}
  </div>;
}