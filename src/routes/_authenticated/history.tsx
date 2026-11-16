import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChannelBadge, EmptyState, fmt, Loading, PageHeader, pretty, resultKind, StatusPill } from "@/components/common";

export const Route = createFileRoute("/_authenticated/history")({
  validateSearch: (s: Record<string, unknown>) => ({ q: typeof s["q"] === "string" ? (s["q"] as string) : undefined }),
  head: () => ({ meta: [{ title: "Interaction History — Kindred Bank" }, { name: "description", content: "Audit log of every incoming and outgoing interaction." }, { property: "og:title", content: "Interaction History — Kindred Bank" }, { property: "og:description", content: "Audit log of every incoming and outgoing interaction." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: HistoryPage,
});

function HistoryPage() {
  const search = Route.useSearch();
  const [q, setQ] = useState(search.q ?? "");
  const [channel, setChannel] = useState("all");
  const [direction, setDirection] = useState("all");
  useEffect(() => { setQ(search.q ?? ""); }, [search.q]);

  const { data, isLoading } = useQuery({
    queryKey: ["logs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("interaction_logs").select("*").order("created_at", { ascending: false }).limit(1000);
      if (error) throw error;
      return data;
    },
  });
  const list = (data ?? []).filter((l) =>
    (channel === "all" || l.channel === channel) && (direction === "all" || l.direction === direction) &&
    (!q || `${l.interaction_summary} ${l.case_reference} ${l.customer_email ?? ""} ${l.result}`.toLowerCase().includes(q.toLowerCase())));

  function exportCsv() {
    const rows = [["timestamp", "channel", "direction", "customer", "summary", "result", "case_reference"], ...list.map((l) => [l.timestamp, l.channel, l.direction, l.customer_email ?? "", l.interaction_summary, l.result, l.case_reference])];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "interaction-log.csv";
    a.click();
  }

  return (
    <>
      <PageHeader title="Interaction History" description="Audit-friendly record of every incoming and outgoing message across channels." actions={<Button variant="outline" onClick={exportCsv} disabled={!list.length}><Download className="mr-2 h-4 w-4" />Export CSV</Button>} />
      <div className="mb-4 flex flex-wrap gap-2">
        <Input className="max-w-xs" placeholder="Search summary, case ref, customer…" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select value={channel} onValueChange={setChannel}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All channels</SelectItem><SelectItem value="email">Email</SelectItem><SelectItem value="social">Social</SelectItem><SelectItem value="voice">Voice</SelectItem></SelectContent></Select>
        <Select value={direction} onValueChange={setDirection}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Both directions</SelectItem><SelectItem value="incoming">Incoming</SelectItem><SelectItem value="outgoing">Outgoing</SelectItem></SelectContent></Select>
      </div>
      <Card><CardContent className="p-0">
        {isLoading ? <div className="p-4"><Loading /></div> : list.length === 0 ? <div className="p-4"><EmptyState title="No matching interactions" /></div> : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Time</TableHead><TableHead>Channel</TableHead><TableHead>Direction</TableHead><TableHead>Customer</TableHead><TableHead>Summary</TableHead><TableHead>Result</TableHead><TableHead>Case</TableHead></TableRow></TableHeader>
              <TableBody>
                {list.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="whitespace-nowrap text-xs">{fmt(l.created_at)}</TableCell>
                    <TableCell><ChannelBadge channel={l.channel} /></TableCell>
                    <TableCell className="text-xs capitalize">{l.direction}</TableCell>
                    <TableCell className="text-xs">{l.customer_email ?? "—"}</TableCell>
                    <TableCell className="max-w-md text-sm">{l.interaction_summary}</TableCell>
                    <TableCell><StatusPill label={pretty(l.result)} kind={resultKind(l.result)} /></TableCell>
                    <TableCell className="whitespace-nowrap font-mono text-xs">{l.case_reference}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent></Card>
    </>
  );
}
