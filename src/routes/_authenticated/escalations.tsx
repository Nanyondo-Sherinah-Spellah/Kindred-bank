import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, LifeBuoy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChannelBadge, EmptyState, fmt, Loading, PageHeader, pretty, StatusPill } from "@/components/common";

export const Route = createFileRoute("/_authenticated/escalations")({
  head: () => ({ meta: [{ title: "Human Support — Kindred Bank" }, { name: "description", content: "Escalated enquiries for staff review." }, { property: "og:title", content: "Human Support — Kindred Bank" }, { property: "og:description", content: "Escalated enquiries for staff review." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: EscalationsPage,
});

const prioKind = { urgent: "bad", high: "warn", medium: "info", low: "muted" } as const;
const statusKind = { open: "bad", in_progress: "warn", resolved: "good", closed: "muted" } as const;

function EscalationsPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState("unresolved");
  const [sel, setSel] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [assignee, setAssignee] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["escalations"],
    queryFn: async () => {
      const { data, error } = await supabase.from("escalations").select("*").order("created_at", { ascending: false }).limit(500);
      if (error) throw error;
      return data;
    },
  });
  const esc = data?.find((e) => e.id === sel) ?? null;
  useEffect(() => { setAssignee(esc?.assigned_to ?? ""); }, [esc?.id]);

  const { data: notes } = useQuery({
    queryKey: ["escalation_notes", sel],
    enabled: !!sel,
    queryFn: async () => (await supabase.from("escalation_notes").select("*").eq("escalation_id", sel!).order("created_at")).data ?? [],
  });

  const refresh = () => { qc.invalidateQueries({ queryKey: ["escalations"] }); qc.invalidateQueries({ queryKey: ["open-escalations-count"] }); };

  async function update(patch: { status?: string; assigned_to?: string | null; priority?: string }) {
    if (!esc) return;
    const { error } = await supabase.from("escalations").update(patch).eq("id", esc.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Case updated");
    refresh();
  }
  async function addNote() {
    if (!esc || !note.trim()) return;
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("escalation_notes").insert({ escalation_id: esc.id, note: note.trim().slice(0, 2000), author_id: u.user!.id, author_email: u.user!.email ?? null });
    if (error) { toast.error(error.message); return; }
    setNote("");
    qc.invalidateQueries({ queryKey: ["escalation_notes", sel] });
  }

  const list = (data ?? []).filter((e) => status === "all" || (status === "unresolved" ? ["open", "in_progress"].includes(e.status) : e.status === status));

  return (
    <>
      <PageHeader title="Human Support" description="Fraud, missing funds, complaints, unanswered questions and anything needing human judgement land here." />
      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Cases</CardTitle>
            <Select value={status} onValueChange={setStatus}><SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="unresolved">Unresolved</SelectItem><SelectItem value="open">Open</SelectItem><SelectItem value="in_progress">In progress</SelectItem><SelectItem value="resolved">Resolved</SelectItem><SelectItem value="closed">Closed</SelectItem><SelectItem value="all">All</SelectItem></SelectContent></Select>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? <div className="p-4"><Loading /></div> : list.length === 0 ? <div className="p-4"><EmptyState title="Nothing waiting" hint="Escalated enquiries will appear here." icon={<CheckCircle2 className="h-8 w-8" />} /></div> : (
              <ul className="max-h-[640px] divide-y overflow-auto">
                {list.map((e) => (
                  <li key={e.id}>
                    <button onClick={() => setSel(e.id)} className={`w-full px-4 py-3 text-left text-sm hover:bg-muted ${sel === e.id ? "bg-accent" : ""}`}>
                      <div className="flex items-center gap-2"><ChannelBadge channel={e.channel} /><span className="truncate font-medium">{e.issue_category}</span><span className="ml-auto"><StatusPill label={e.priority} kind={prioKind[e.priority as keyof typeof prioKind] ?? "muted"} /></span></div>
                      <div className="mt-1 truncate text-muted-foreground">{e.description}</div>
                      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground"><StatusPill label={pretty(e.status)} kind={statusKind[e.status as keyof typeof statusKind] ?? "muted"} />{fmt(e.created_at)} · {e.assigned_to ?? "unassigned"}</div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card className="h-fit">
          {!esc ? <CardContent className="p-6"><EmptyState title="Select a case" icon={<LifeBuoy className="h-8 w-8" />} /></CardContent> : (
            <>
              <CardHeader>
                <CardTitle className="text-base">{esc.issue_category}</CardTitle>
                <p className="text-sm text-muted-foreground">{esc.customer_email ?? "Unknown customer"} · <span className="font-mono">{esc.case_reference}</span> · {fmt(esc.created_at)}</p>
              </CardHeader>
              <CardContent className="space-y-5">
                <div><Label>Escalation reason</Label><p className="mt-1 whitespace-pre-wrap rounded-md bg-muted p-3 text-sm">{esc.description}</p></div>
                {esc.conversation_summary && <div><Label>Conversation summary</Label><p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{esc.conversation_summary}</p></div>}
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1"><Label>Status</Label>
                    <Select value={esc.status} onValueChange={(v) => update({ status: v })}><SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="open">Open</SelectItem><SelectItem value="in_progress">In progress</SelectItem><SelectItem value="resolved">Resolved</SelectItem><SelectItem value="closed">Closed</SelectItem></SelectContent></Select></div>
                  <div className="space-y-1"><Label>Priority</Label>
                    <Select value={esc.priority} onValueChange={(v) => update({ priority: v })}><SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="low">Low</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="high">High</SelectItem><SelectItem value="urgent">Urgent</SelectItem></SelectContent></Select></div>
                  <div className="space-y-1"><Label>Assigned to</Label>
                    <div className="flex gap-1"><Input value={assignee} onChange={(e) => setAssignee(e.target.value)} placeholder="Staff name" maxLength={100} /><Button variant="secondary" onClick={() => update({ assigned_to: assignee.trim() || null })}>Save</Button></div></div>
                </div>
                <Button onClick={() => update({ status: "resolved" })} disabled={esc.status === "resolved"}><CheckCircle2 className="mr-2 h-4 w-4" />Mark resolved</Button>
                <div className="space-y-2">
                  <Label>Internal notes</Label>
                  {notes?.length ? (
                    <ul className="space-y-2">{notes.map((n) => <li key={n.id} className="rounded-md border p-2.5 text-sm"><p>{n.note}</p><p className="mt-1 text-xs text-muted-foreground">{n.author_email} · {fmt(n.created_at)}</p></li>)}</ul>
                  ) : <p className="text-sm text-muted-foreground">No notes yet.</p>}
                  <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add an internal note (not visible to the customer)" maxLength={2000} />
                  <Button size="sm" variant="outline" onClick={addNote} disabled={!note.trim()}>Add note</Button>
                </div>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </>
  );
}
