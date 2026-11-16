import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Send, Sparkles, LifeBuoy, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { approveEmail, escalateEmail, processEmail } from "@/lib/cs.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, fmt, Loading, PageHeader, pretty, resultKind, StatusPill } from "@/components/common";
import { DemoBanner, useIntegrations } from "@/components/integration-banner";

export const Route = createFileRoute("/_authenticated/email")({
  head: () => ({ meta: [{ title: "Email Assistant — Kindred Bank" }, { name: "description", content: "Review, edit and send AI-prepared email replies." }, { property: "og:title", content: "Email Assistant — Kindred Bank" }, { property: "og:description", content: "Review, edit and send AI-prepared email replies." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: EmailPage,
});

const PRESETS = [
  { label: "Business loan", sender: "john@example.com", subject: "Loan documents", body: "What documents do I need for a business loan?" },
  { label: "Branch hours", sender: "mary@example.com", subject: "Opening times", body: "Hello, what are your branch opening hours?" },
  { label: "Personal repayment", sender: "john@example.com", subject: "My repayment", body: "When is my next repayment due and how much is it?" },
  { label: "Unknown question", sender: "visitor@example.com", subject: "Crypto", body: "Do you offer cryptocurrency trading accounts?" },
  { label: "Missing money", sender: "mary@example.com", subject: "Urgent", body: "Money is missing from my account since yesterday, please help." },
];

function EmailPage() {
  const qc = useQueryClient();
  const integ = useIntegrations();
  const process = useServerFn(processEmail);
  const approve = useServerFn(approveEmail);
  const esc = useServerFn(escalateEmail);
  const [form, setForm] = useState({ sender: "", subject: "", body: "" });
  const [auto, setAuto] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [filter, setFilter] = useState("all");
  const [acting, setActing] = useState(false);

  useEffect(() => {
    supabase.from("app_settings").select("email_auto_respond").eq("id", 1).maybeSingle().then(({ data }) => {
      if (data) setAuto(data.email_auto_respond);
    });
  }, []);

  const { data: inbox, isLoading } = useQuery({
    queryKey: ["email_messages"],
    queryFn: async () => {
      const { data, error } = await supabase.from("email_messages").select("*").order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return data;
    },
  });
  const msg = inbox?.find((m) => m.id === selected) ?? null;
  useEffect(() => { if (msg) setDraft(msg.final_response ?? msg.draft_response ?? ""); }, [msg?.id]);

  const refresh = () => { qc.invalidateQueries({ queryKey: ["email_messages"] }); qc.invalidateQueries({ queryKey: ["open-escalations-count"] }); };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await process({ data: { ...form, auto } });
      toast.success(`Processed · ${pretty(r.classification.intent)}`, { description: r.delivery ? r.delivery.note : r.decision.escalate ? "Escalation created for human support." : "Draft ready for review." });
      if (r.classification.note) toast.warning(r.classification.note);
      refresh();
      setSelected(r.id);
      setForm({ sender: "", subject: "", body: "" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to process email");
    } finally { setBusy(false); }
  }

  async function doApprove() {
    if (!msg) return;
    setActing(true);
    try {
      const r = await approve({ data: { id: msg.id, body: draft } });
      r.status === "sent" ? toast.success(r.note) : r.status === "send_failed" ? toast.error(r.note) : toast.info(r.note);
      refresh();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); } finally { setActing(false); }
  }
  async function doEscalate() {
    if (!msg) return;
    setActing(true);
    try { await esc({ data: { id: msg.id, reason: "Escalated by staff from the Email Assistant" } }); toast.success("Escalated to human support"); refresh(); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); } finally { setActing(false); }
  }

  const list = (inbox ?? []).filter((m) => filter === "all" || m.status === filter);

  return (
    <>
      <PageHeader title="Email Assistant" description="Incoming emails are classified, matched to approved answers and prepared as replies. Unanswerable questions are escalated — never guessed." />
      <DemoBanner connected={integ.data ? integ.data.gmail || integ.data.outlook : undefined} label="Email service" />
      <div className="grid min-w-0 gap-4 sm:gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <div className="min-w-0 space-y-4 sm:space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Demo: receive an email</CardTitle></CardHeader>
            <CardContent>
              <div className="mb-3 flex flex-wrap gap-1.5">
                {PRESETS.map((p) => (
                  <Button key={p.label} type="button" size="sm" variant="secondary" onClick={() => setForm({ sender: p.sender, subject: p.subject, body: p.body })}>{p.label}</Button>
                ))}
              </div>
              <form onSubmit={submit} className="space-y-3">
                <div className="space-y-1"><Label>From</Label><Input type="email" required value={form.sender} onChange={(e) => setForm({ ...form, sender: e.target.value })} placeholder="customer@example.com" /></div>
                <div className="space-y-1"><Label>Subject</Label><Input value={form.subject} maxLength={300} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></div>
                <div className="space-y-1"><Label>Message</Label><Textarea required rows={4} maxLength={5000} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></div>
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-md border p-2.5">
                  <div className="text-sm"><div className="font-medium">Automatic response</div><div className="text-xs text-muted-foreground">Send matched answers without review</div></div>
                  <Switch checked={auto} onCheckedChange={setAuto} />
                </div>
                <Button type="submit" className="w-full" disabled={busy}><Sparkles className="mr-2 h-4 w-4" />{busy ? "Analysing…" : "Process email"}</Button>
              </form>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 space-y-0">
              <CardTitle className="text-base">Inbox</CardTitle>
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="h-8 w-36 sm:w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="pending_review">Pending review</SelectItem>
                  <SelectItem value="approved_not_sent">Approved, not sent</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="escalated">Escalated</SelectItem>
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? <div className="p-4"><Loading /></div> : list.length === 0 ? <div className="p-4"><EmptyState title="Inbox is empty" hint="Use a demo preset above to receive an email." icon={<Mail className="h-8 w-8" />} /></div> : (
                <ul className="max-h-[480px] divide-y overflow-auto">
                  {list.map((m) => (
                    <li key={m.id}>
                      <button onClick={() => setSelected(m.id)} className={`w-full px-4 py-3 text-left text-sm hover:bg-muted ${selected === m.id ? "bg-accent" : ""}`}>
                        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2"><span className="truncate font-medium">{m.sender}</span><span className="shrink-0 text-xs text-muted-foreground">{fmt(m.created_at)}</span></div>
                        <div className="truncate text-muted-foreground">{m.subject || m.body}</div>
                        <div className="mt-1"><StatusPill label={pretty(m.status)} kind={resultKind(m.status)} /></div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
        <Card className="h-fit min-w-0 break-words">
          {!msg ? <CardContent className="p-6"><EmptyState title="Select an email" hint="Open a message from the inbox to review the AI-prepared response." /></CardContent> : (
            <>
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="text-base">{msg.subject || "(no subject)"}</CardTitle>
                  <StatusPill label={pretty(msg.status)} kind={resultKind(msg.status)} />
                  {msg.intent && <StatusPill label={`intent: ${pretty(msg.intent)}`} kind="info" />}
                </div>
                <p className="text-sm text-muted-foreground">From {msg.sender} · {fmt(msg.created_at)} · <span className="font-mono">{msg.case_reference}</span></p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="whitespace-pre-wrap rounded-md bg-muted p-4 text-sm">{msg.body}</div>
                <div className="space-y-1">
                  <Label>AI-prepared response {msg.knowledge_id ? "(from approved knowledge)" : "(no approved answer matched)"}</Label>
                  <Textarea rows={11} value={draft} onChange={(e) => setDraft(e.target.value)} disabled={msg.status === "sent"} />
                </div>
                {msg.delivery_note && <p className="text-xs text-muted-foreground">Note: {msg.delivery_note}</p>}
                <div className="grid gap-2 sm:flex sm:flex-wrap">
                  <Button onClick={doApprove} disabled={acting || msg.status === "sent" || !draft.trim()}><Send className="mr-2 h-4 w-4" />Approve & send</Button>
                  <Button variant="outline" onClick={doEscalate} disabled={acting || !!msg.escalation_id}><LifeBuoy className="mr-2 h-4 w-4" />{msg.escalation_id ? "Escalated" : "Escalate to human"}</Button>
                </div>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </>
  );
}
