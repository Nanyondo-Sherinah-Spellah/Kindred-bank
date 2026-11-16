import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Activity, CheckCircle2, LifeBuoy, Mail, MessageCircle, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChannelBadge, EmptyState, fmt, Loading, PageHeader, pretty, resultKind, StatusPill } from "@/components/common";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Kindred Bank" }, { name: "description", content: "Customer service performance across email, social and voice." }, { property: "og:title", content: "Dashboard — Kindred Bank" }, { property: "og:description", content: "Customer service performance across email, social and voice." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Dashboard,
});

const RESOLVED = /^(answer|sent|approved_not_sent|public_reply|private_redirect|verified_resolved|verify|greet)$/;

function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const [logs, esc] = await Promise.all([
        supabase.from("interaction_logs").select("*").order("created_at", { ascending: false }).limit(1000),
        supabase.from("escalations").select("id, channel, status"),
      ]);
      if (logs.error) throw logs.error;
      return { logs: logs.data ?? [], esc: esc.data ?? [] };
    },
  });

  if (isLoading || !data) return <><PageHeader title="Dashboard" /><Loading rows={6} /></>;

  const incoming = data.logs.filter((l) => l.direction === "incoming");
  const byChannel = (c: string) => incoming.filter((l) => l.channel === c).length;
  const resolved = data.logs.filter((l) => l.direction === "outgoing" && RESOLVED.test(l.result)).length;
  const escalated = data.esc.length;

  const stats = [
    { label: "Total interactions", value: incoming.length, icon: Activity },
    { label: "Email", value: byChannel("email"), icon: Mail },
    { label: "Social media", value: byChannel("social"), icon: MessageCircle },
    { label: "Voice", value: byChannel("voice"), icon: Phone },
    { label: "Resolved automatically", value: resolved, icon: CheckCircle2 },
    { label: "Escalated", value: escalated, icon: LifeBuoy },
  ];

  const channels = ["email", "social", "voice"].map((c) => {
    const total = byChannel(c);
    const esc = data.esc.filter((e) => e.channel === c).length;
    const res = data.logs.filter((l) => l.channel === c && l.direction === "outgoing" && RESOLVED.test(l.result)).length;
    return { c, total, esc, res, rate: total ? Math.round((Math.min(res, total) / total) * 100) : 0 };
  });

  return (
    <>
      <PageHeader title="Dashboard" description="Live overview of automated customer service across all channels." />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <s.icon className="mb-2 h-4 w-4 text-teal" />
              <div className="font-display text-2xl font-bold">{s.value}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Channel performance</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            {channels.map((ch) => (
              <div key={ch.c}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <ChannelBadge channel={ch.c} />
                  <span className="text-muted-foreground">{ch.total} enquiries · {ch.esc} escalated</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-teal" style={{ width: `${ch.rate}%` }} />
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{ch.rate}% handled without a human</div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card className="lg:col-span-3">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Recent activity</CardTitle>
            <Link to="/history" search={{ q: undefined }} className="text-sm text-teal hover:underline">View all</Link>
          </CardHeader>
          <CardContent>
            {data.logs.length === 0 ? (
              <EmptyState title="No interactions yet" hint="Try a demo scenario in the Email, Social or Voice assistant." />
            ) : (
              <ul className="divide-y">
                {data.logs.slice(0, 8).map((l) => (
                  <li key={l.id} className="flex items-start gap-3 py-2.5 text-sm">
                    <ChannelBadge channel={l.channel} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate">{l.interaction_summary}</p>
                      <p className="text-xs text-muted-foreground">{l.direction} · {l.case_reference} · {fmt(l.created_at)}</p>
                    </div>
                    <StatusPill label={pretty(l.result)} kind={resultKind(l.result)} />
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
