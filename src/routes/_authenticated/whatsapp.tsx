import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { processWhatsappDemo } from "@/lib/cs.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/common";
import { WhatsAppIcon } from "@/components/whatsapp-icon";
import { useIntegrations } from "@/components/integration-banner";

export const Route = createFileRoute("/_authenticated/whatsapp")({
  head: () => ({ meta: [{ title: "WhatsApp Assistant — Kindred Bank" }, { name: "description", content: "Try Kindred Bank's WhatsApp assistant in demo mode." }, { property: "og:title", content: "WhatsApp Assistant — Kindred Bank" }, { property: "og:description", content: "Try Kindred Bank's WhatsApp assistant in demo mode." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: WhatsAppPage,
});

const PRESETS = ["Good morning", "I want to know about your loans", "Can I repay my loan early?", "How far, wetin be una branch hours?", "Someone used my account without permission"];
type Msg = { role: "customer" | "assistant"; text: string };

function WhatsAppPage() {
  const qc = useQueryClient();
  const integ = useIntegrations();
  const send = useServerFn(processWhatsappDemo);
  const [phone, setPhone] = useState("+234 803 000 0000");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  async function submit(t: string) {
    if (!t.trim() || busy) return;
    setMsgs((m) => [...m, { role: "customer", text: t }]);
    setText("");
    setBusy(true);
    try {
      const r = await send({ data: { phone, body: t } });
      setMsgs((m) => [...m, { role: "assistant", text: r.reply }]);
      if (r.escalated) qc.invalidateQueries({ queryKey: ["open-escalations-count"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); } finally { setBusy(false); }
  }

  return (
    <>
      <PageHeader title="WhatsApp Assistant" description="Chat as a customer would on WhatsApp. Replies come from the same assistant and approved bank information as every other channel." />
      <div className="mb-4 rounded-md border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
        <strong>Demo mode.</strong>{" "}
        {integ.data?.whatsapp ? "WhatsApp Business is connected; real customer messages are answered automatically. Messages here are not sent to a phone." : "WhatsApp Business is not connected, so nothing here is sent to a real phone."}{" "}
        Every message is saved in the interaction history.
      </div>
      <Card className="flex min-h-[420px] min-w-0 flex-col sm:min-h-[560px]">
        <CardHeader className="flex-row flex-wrap items-center gap-3 space-y-0 border-b">
          <WhatsAppIcon className="h-5 w-5 text-primary" />
          <CardTitle className="flex-1 text-base">Conversation</CardTitle>
          <div className="flex min-w-0 items-center gap-2">
            <Label htmlFor="wa-phone" className="shrink-0 text-xs text-muted-foreground">Customer phone</Label>
            <Input id="wa-phone" value={phone} onChange={(e) => setPhone(e.target.value)} className="h-9 w-44" />
          </div>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col gap-3 p-3 sm:p-4">
          <div className="flex max-h-[55vh] flex-1 flex-col gap-2 overflow-y-auto rounded-md bg-secondary p-3">
            {msgs.length === 0 && <p className="m-auto text-center text-sm text-muted-foreground">Send a message to start the chat.</p>}
            {msgs.map((m, i) => (
              <div key={i} className={`max-w-[85%] whitespace-pre-wrap break-words rounded-lg px-3 py-2 text-sm shadow-sm ${m.role === "customer" ? "ml-auto bg-primary text-primary-foreground" : "bg-card text-foreground"}`}>{m.text}</div>
            ))}
            {busy && <div className="bg-card text-muted-foreground max-w-[85%] rounded-lg px-3 py-2 text-sm">Typing…</div>}
            <div ref={endRef} />
          </div>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => <Button key={p} variant="outline" size="sm" disabled={busy} onClick={() => submit(p)}>{p}</Button>)}
          </div>
          <form className="grid grid-cols-[minmax(0,1fr)_auto] gap-2" onSubmit={(e) => { e.preventDefault(); submit(text); }}>
            <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a message" maxLength={2000} />
            <Button type="submit" disabled={busy || !text.trim()} aria-label="Send"><Send className="h-4 w-4" /></Button>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
