import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ChannelBadge, EmptyState, fmt, Loading } from "@/components/common";
import { ticketsQuery } from "@/lib/admin-data";
import { AdminCharts } from "@/components/admin-charts";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Admin dashboard — Kindred Bank" },
      { name: "description", content: "All customer service tickets across channels." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Admin dashboard — Kindred Bank" },
      { property: "og:description", content: "All customer service tickets across channels." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminDashboard,
});

const TABS = [
  { key: "all", label: "All tickets" },
  { key: "voice", label: "Voice & Chatbot" },
  { key: "email", label: "Email" },
  { key: "social", label: "Social media" },
  { key: "whatsapp", label: "WhatsApp" },
] as const;


function AdminDashboard() {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("all");
  const { data, isLoading } = useQuery(ticketsQuery);
  const qc = useQueryClient();
  const setStatus = async (id: string, status: "open" | "closed") => {
    const prev = qc.getQueryData(ticketsQuery.queryKey);
    qc.setQueryData(ticketsQuery.queryKey, (old) => old?.map((r) => (r.id === id ? { ...r, status } : r)));
    const { error } = await supabase.from("escalations").update({ status }).eq("id", id);
    if (error) {
      qc.setQueryData(ticketsQuery.queryKey, prev);
      toast.error("Couldn't update the ticket. Please try again.");
    } else toast.success(`Ticket marked ${status}`);
  };
  const rows = (data ?? []).filter((r) => tab === "all" || r.channel === tab);
  const count = (k: string) => (data ?? []).filter((r) => k === "all" || r.channel === k).length;

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Customer service tickets</h1>
      {data && data.length > 0 && <AdminCharts tickets={data} />}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`rounded-lg border p-3 text-left transition ${tab === t.key ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary"}`}>
            <div className="text-xs opacity-80">{t.label}</div>
            <div className="text-2xl font-bold">{count(t.key)}</div>
          </button>
        ))}
      </div>
      {isLoading ? <Loading /> : rows.length === 0 ? <EmptyState title="No tickets yet" /> : (
        <div className="space-y-3">
          {rows.map((r) => (
            <Card key={r.id}>
              <CardContent className="space-y-2 p-4">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <ChannelBadge channel={r.channel} />
                  <Select value={r.status === "resolved" || r.status === "closed" ? "closed" : "open"} onValueChange={(v) => setStatus(r.id, v as "open" | "closed")}>
                    <SelectTrigger aria-label="Ticket status" className={`h-7 w-28 text-xs font-medium ${r.status === "resolved" || r.status === "closed" ? "border-success text-success" : "border-destructive text-destructive"}`}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                  <span className="text-muted-foreground">{r.case_reference}</span>
                  <span className="ml-auto text-muted-foreground">{fmt(r.created_at)}</span>
                </div>
                <p className="font-medium">{r.issue_category}</p>
                <p className="break-words text-sm text-muted-foreground">{r.description}</p>
                {r.customer_email && <p className="text-xs text-muted-foreground">Customer: {r.customer_email}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
