import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Bot, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { askAdminAssistant } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/assistant")({
  head: () => ({
    meta: [
      { title: "AI Assistant — Kindred Bank Admin" },
      { name: "description", content: "Ask questions about customer service tickets." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "AI Assistant — Kindred Bank Admin" },
      { property: "og:description", content: "Ask questions about customer service tickets." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AssistantPage,
});

type Msg = { role: "user" | "assistant"; content: string };
const SUGGESTIONS = [
  "How many tickets are open on each channel?",
  "What are the most common issues this week?",
  "Which tickets are urgent or high priority?",
  "Summarise today's email tickets.",
];

function AssistantPage() {
  const ask = useServerFn(askAdminAssistant);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    const next = [...messages, { role: "user" as const, content: q }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const r = await ask({ data: { messages: next } });
      setMessages([...next, { role: "assistant", content: r.answer }]);
    } catch (e) {
      setMessages([...next, { role: "assistant", content: `Sorry, I couldn't answer that: ${e instanceof Error ? e.message : "error"}` }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-[calc(100svh-7rem)] min-h-[28rem] flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">AI Assistant</h1>
        <p className="text-sm text-muted-foreground">Ask questions about the tickets on your dashboard.</p>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto rounded-lg border bg-card p-4">
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="flex items-center gap-2 text-sm text-muted-foreground"><Bot className="h-4 w-4" /> Try one of these:</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => <Button key={s} variant="outline" size="sm" onClick={() => send(s)}>{s}</Button>)}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`max-w-[85%] whitespace-pre-wrap break-words rounded-lg px-3 py-2 text-sm ${m.role === "user" ? "ml-auto bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>
            {m.content}
          </div>
        ))}
        {busy && <div className="w-fit rounded-lg bg-secondary px-3 py-2 text-sm text-muted-foreground">Thinking…</div>}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex gap-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
          placeholder="Ask about the tickets…"
          rows={2}
          className="min-h-11 flex-1 resize-none"
        />
        <Button type="submit" size="icon" className="h-auto w-12" disabled={busy || !input.trim()} aria-label="Send"><Send className="h-4 w-4" /></Button>
      </form>
    </div>
  );
}
