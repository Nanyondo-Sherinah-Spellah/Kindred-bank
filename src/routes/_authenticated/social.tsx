import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Copy, Globe, Lock, LifeBuoy, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { processSocial } from "@/lib/cs.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, fmt, Loading, PageHeader, pretty, resultKind, StatusPill } from "@/components/common";
import { useIntegrations } from "@/components/integration-banner";

export const Route = createFileRoute("/_authenticated/social")({
  head: () => ({ meta: [{ title: "Social Media Assistant — Kindred Bank" }, { name: "description", content: "Public replies and private redirects for Facebook, Instagram and X." }, { property: "og:title", content: "Social Media Assistant — Kindred Bank" }, { property: "og:description", content: "Public replies and private redirects for Facebook, Instagram and X." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: SocialPage,
});

const PRESETS = [
  { label: "Business loan (public)", type: "comment", body: "What documents do I need for a business loan?" },
  { label: "Repayment (personal)", type: "comment", body: "When is my next repayment due?" },
  { label: "Branch hours", type: "comment", body: "What time do your branches close?" },
  { label: "Fraud report", type: "direct_message", body: "Someone used my account without permission, I think it's fraud!" },
  { label: "Complaint", type: "comment", body: "Terrible service at your branch today, very disappointed." },
] as const;

type Platform = "facebook" | "instagram" | "x";

function SocialPage() {
  const qc = useQueryClient();
  const integ = useIntegrations();
  const run = useServerFn(processSocial);
  const [platform, setPlatform] = useState<Platform>("facebook");
  const [type, setType] = useState<"comment" | "direct_message">("comment");
  const [author, setAuthor] = useState("@demo_customer");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<Awaited<ReturnType<typeof run>> | null>(null);
  const [pf, setPf] = useState("all");

  const { data, isLoading } = useQuery({
    queryKey: ["social_messages"],
    queryFn: async () => {
      const { data, error } = await supabase.from("social_messages").select("*").order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return data;
    },
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await run({ data: { platform, messageType: type, author, body } });
      setLast(r);
      toast.success(`Processed · ${pretty(r.action)}`);
      setBody("");
      qc.invalidateQueries({ queryKey: ["social_messages"] });
      qc.invalidateQueries({ queryKey: ["open-escalations-count"] });
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); } finally { setBusy(false); }
  }

  const status = (p: Platform) => (integ.data ? (p === "x" ? integ.data.x : integ.data.meta) : undefined);
  const list = (data ?? []).filter((m) => pf === "all" || m.platform === pf);

  return (
    <>
      <PageHeader title="Social Media Assistant" description="General questions get approved public answers. Personal financial enquiries are redirected privately — never answered in public. Complaints and fraud go to humans." />
      <div className="mb-4 grid min-w-0 gap-3 lg:grid-cols-3">
        {(["facebook", "instagram", "x"] as Platform[]).map((p) => (
          <Card key={p}><CardContent className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 p-4">
            <span className="font-medium capitalize">{p}</span>
            <StatusPill label={status(p) === undefined ? "checking" : status(p) ? "credentials present" : "not connected"} kind={status(p) ? "good" : "muted"} />
          </CardContent></Card>
        ))}
      </div>
      <div className="grid min-w-0 gap-4 sm:gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <div className="min-w-0 space-y-4 sm:space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Demo: incoming comment or message</CardTitle></CardHeader>
            <CardContent>
              <div className="mb-3 flex flex-wrap gap-1.5">
                {PRESETS.map((p) => <Button key={p.label} size="sm" variant="secondary" onClick={() => { setBody(p.body); setType(p.type); }}>{p.label}</Button>)}
              </div>
              <form onSubmit={submit} className="space-y-3">
                <div className="grid min-w-0 gap-3 sm:grid-cols-2 sm:gap-2">
                  <div className="space-y-1"><Label>Platform</Label>
                    <Select value={platform} onValueChange={(v) => setPlatform(v as Platform)}><SelectTrigger className="w-full min-w-0"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="facebook">Facebook</SelectItem><SelectItem value="instagram">Instagram</SelectItem><SelectItem value="x">X (formerly Twitter)</SelectItem></SelectContent></Select>
                  </div>
                  <div className="space-y-1"><Label>Type</Label>
                    <Select value={type} onValueChange={(v) => setType(v as typeof type)}><SelectTrigger className="w-full min-w-0"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="comment">Public comment</SelectItem><SelectItem value="direct_message">Direct message</SelectItem></SelectContent></Select>
                  </div>
                </div>
                <div className="space-y-1"><Label>Author handle</Label><Input required maxLength={100} value={author} onChange={(e) => setAuthor(e.target.value)} /></div>
                <div className="space-y-1"><Label>Message</Label><Textarea required rows={3} maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)} /></div>
                <Button type="submit" className="w-full" disabled={busy}><Sparkles className="mr-2 h-4 w-4" />{busy ? "Analysing…" : "Process message"}</Button>
              </form>
            </CardContent>
          </Card>
          {last && (
            <Card className="min-w-0 break-words border-teal/40">
              <CardHeader><CardTitle className="flex items-center gap-2 text-base">
                {last.action === "public_reply" ? <Globe className="h-4 w-4 text-teal" /> : last.action === "private_redirect" ? <Lock className="h-4 w-4 text-warning" /> : <LifeBuoy className="h-4 w-4 text-destructive" />}
                AI response preview</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex flex-wrap gap-2"><StatusPill label={pretty(last.action)} kind={resultKind(last.action)} /><StatusPill label={`intent: ${pretty(last.classification.intent)}`} kind="info" /></div>
                <p className="rounded-md bg-muted p-3">{last.decision.response}</p>
                <p className="text-xs text-muted-foreground">{last.note} Case <span className="font-mono">{last.caseReference}</span>.</p>
                <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(last.decision.response); toast.success("Reply copied"); }}><Copy className="mr-2 h-3.5 w-3.5" />Copy reply</Button>
              </CardContent>
            </Card>
          )}
        </div>
        <Card className="min-w-0 break-words">
          <CardHeader className="grid gap-3 space-y-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <CardTitle className="text-base">Comment monitoring</CardTitle>
            <Select value={pf} onValueChange={setPf}><SelectTrigger className="h-8 w-full sm:w-36"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">All platforms</SelectItem><SelectItem value="facebook">Facebook</SelectItem><SelectItem value="instagram">Instagram</SelectItem><SelectItem value="x">X (formerly Twitter)</SelectItem></SelectContent></Select>
          </CardHeader>
          <CardContent>
            {isLoading ? <Loading /> : list.length === 0 ? <EmptyState title="No social messages yet" hint="Process a demo comment to see it here." /> : (
              <ul className="space-y-3">
                {list.map((m) => (
                  <li key={m.id} className="rounded-md border p-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-medium capitalize text-foreground">{m.platform}</span>· {m.message_type === "comment" ? "public comment" : "DM"} · {m.author_handle} · {fmt(m.created_at)}
                      <span className="ml-auto"><StatusPill label={pretty(m.action ?? "")} kind={resultKind(m.action ?? "")} /></span>
                    </div>
                    <p className="mt-1.5">{m.body}</p>
                    <p className="mt-2 border-l-2 border-teal pl-3 text-muted-foreground">{m.response}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{m.delivery_note} · <span className="font-mono">{m.case_reference}</span></p>
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
