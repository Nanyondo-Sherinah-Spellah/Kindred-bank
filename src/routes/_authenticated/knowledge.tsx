import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, fmt, Loading, PageHeader } from "@/components/common";

export const Route = createFileRoute("/_authenticated/knowledge")({
  head: () => ({ meta: [{ title: "Knowledge Base — Kindred Bank" }, { name: "description", content: "Approved answers used by every channel." }, { property: "og:title", content: "Knowledge Base — Kindred Bank" }, { property: "og:description", content: "Approved answers used by every channel." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: KnowledgePage,
});

type Row = { id?: string; topic: string; keywords: string; approved_answer: string; category: string };
const empty: Row = { topic: "", keywords: "", approved_answer: "", category: "General" };

function KnowledgePage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<Row | null>(null);
  const [saving, setSaving] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["knowledge"],
    queryFn: async () => {
      const { data, error } = await supabase.from("knowledge").select("*").order("topic");
      if (error) throw error;
      return data;
    },
  });

  async function save() {
    if (!edit) return;
    const payload = {
      topic: edit.topic.trim().slice(0, 200),
      keywords: edit.keywords.split(",").map((k) => k.trim().toLowerCase()).filter(Boolean).slice(0, 30),
      approved_answer: edit.approved_answer.trim().slice(0, 4000),
      category: edit.category.trim().slice(0, 80) || "General",
    };
    if (!payload.topic || !payload.approved_answer) { toast.error("Topic and approved answer are required"); return; }
    setSaving(true);
    const { error } = edit.id ? await supabase.from("knowledge").update(payload).eq("id", edit.id) : await supabase.from("knowledge").insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Knowledge saved");
    setEdit(null);
    qc.invalidateQueries({ queryKey: ["knowledge"] });
  }
  async function remove(id: string) {
    if (!confirm("Delete this approved answer?")) return;
    const { error, count } = await supabase.from("knowledge").delete({ count: "exact" }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    if (!count) { toast.error("Only administrators can delete knowledge entries."); return; }
    toast.success("Deleted");
    qc.invalidateQueries({ queryKey: ["knowledge"] });
  }

  const list = (data ?? []).filter((k) => !q || `${k.topic} ${k.keywords.join(" ")} ${k.approved_answer} ${k.category}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <>
      <PageHeader title="Knowledge Base" description="The single source of truth. Assistants only answer with these approved answers — anything not covered here is escalated."
        actions={<Button onClick={() => setEdit(empty)}><Plus className="mr-2 h-4 w-4" />Add answer</Button>} />
      <Input className="mb-4 max-w-sm" placeholder="Search topics, keywords…" value={q} onChange={(e) => setQ(e.target.value)} />
      {isLoading ? <Loading /> : list.length === 0 ? <EmptyState title="No approved answers found" /> : (
        <div className="grid gap-4 md:grid-cols-2">
          {list.map((k) => (
            <Card key={k.id}><CardContent className="space-y-2 p-5">
              <div className="flex items-start justify-between gap-2">
                <div><h3 className="font-semibold">{k.topic}</h3><span className="text-xs text-muted-foreground">{k.category} · updated {fmt(k.updated_at)}</span></div>
                <div className="flex">
                  <Button size="icon" variant="ghost" aria-label="Edit" onClick={() => setEdit({ id: k.id, topic: k.topic, keywords: k.keywords.join(", "), approved_answer: k.approved_answer, category: k.category })}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" aria-label="Delete" onClick={() => remove(k.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
              <p className="text-sm">{k.approved_answer}</p>
              <div className="flex flex-wrap gap-1">{k.keywords.map((w) => <span key={w} className="rounded bg-accent px-1.5 py-0.5 text-xs text-accent-foreground">{w}</span>)}</div>
            </CardContent></Card>
          ))}
        </div>
      )}
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit?.id ? "Edit approved answer" : "New approved answer"}</DialogTitle></DialogHeader>
          {edit && (
            <div className="space-y-3">
              <div className="space-y-1"><Label>Topic</Label><Input value={edit.topic} onChange={(e) => setEdit({ ...edit, topic: e.target.value })} /></div>
              <div className="space-y-1"><Label>Category</Label><Input value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value })} /></div>
              <div className="space-y-1"><Label>Keywords (comma separated)</Label><Input value={edit.keywords} onChange={(e) => setEdit({ ...edit, keywords: e.target.value })} /></div>
              <div className="space-y-1"><Label>Approved answer</Label><Textarea rows={5} value={edit.approved_answer} onChange={(e) => setEdit({ ...edit, approved_answer: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter><Button variant="ghost" onClick={() => setEdit(null)}>Cancel</Button><Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
