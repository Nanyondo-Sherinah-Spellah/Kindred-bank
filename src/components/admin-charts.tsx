import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CHANNEL_LABEL } from "@/lib/admin-data";

type Ticket = { status: string; channel: string; created_at: string; issue_category: string | null };

const OPEN = "var(--destructive)";
const CLOSED = "var(--success)";
export const isClosed = (s: string) => s === "resolved" || s === "closed";

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent className="h-64 p-2">
        <ResponsiveContainer width="100%" height="100%">{children as React.ReactElement}</ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export function AdminCharts({ tickets }: { tickets: Ticket[] }) {
  const closed = tickets.filter((t) => isClosed(t.status)).length;
  const open = tickets.length - closed;
  const statusData = [
    { name: "Open", value: open, fill: OPEN },
    { name: "Closed", value: closed, fill: CLOSED },
  ];

  const byChannel = Object.entries(CHANNEL_LABEL).map(([k, label]) => {
    const rows = tickets.filter((t) => t.channel === k);
    const c = rows.filter((t) => isClosed(t.status)).length;
    return { name: label, Open: rows.length - c, Closed: c };
  });

  const days: { day: string; Tickets: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const key = d.toISOString().slice(0, 10);
    days.push({ day: d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }), Tickets: tickets.filter((t) => t.created_at.slice(0, 10) === key).length });
  }

  const cats = new Map<string, number>();
  tickets.forEach((t) => { const c = t.issue_category || "Other"; cats.set(c, (cats.get(c) ?? 0) + 1); });
  const topCats = [...cats.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, value]) => ({ name: name.length > 22 ? name.slice(0, 21) + "…" : name, value }));

  const rate = tickets.length ? Math.round((closed / tickets.length) * 100) : 0;
  const axis = { fontSize: 11, fill: "var(--muted-foreground)" };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border bg-card p-3"><div className="text-xs text-muted-foreground">Open</div><div className="text-2xl font-bold text-destructive">{open}</div></div>
        <div className="rounded-lg border bg-card p-3"><div className="text-xs text-muted-foreground">Closed</div><div className="text-2xl font-bold text-success">{closed}</div></div>
        <div className="rounded-lg border bg-card p-3"><div className="text-xs text-muted-foreground">Resolution rate</div><div className="text-2xl font-bold">{rate}%</div></div>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <Panel title="Open vs closed tickets">
          <PieChart>
            <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={85} label>
              {statusData.map((d) => <Cell key={d.name} fill={d.fill} />)}
            </Pie>
            <Tooltip /><Legend />
          </PieChart>
        </Panel>
        <Panel title="Tickets by channel">
          <BarChart data={byChannel}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="name" tick={axis} /><YAxis allowDecimals={false} tick={axis} />
            <Tooltip /><Legend />
            <Bar dataKey="Open" stackId="a" fill={OPEN} />
            <Bar dataKey="Closed" stackId="a" fill={CLOSED} />
          </BarChart>
        </Panel>
        <Panel title="New tickets — last 14 days">
          <LineChart data={days}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="day" tick={axis} /><YAxis allowDecimals={false} tick={axis} />
            <Tooltip />
            <Line type="monotone" dataKey="Tickets" stroke="var(--primary)" strokeWidth={2} />
          </LineChart>
        </Panel>
        <Panel title="Top issues">
          <BarChart data={topCats} layout="vertical" margin={{ left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis type="number" allowDecimals={false} tick={axis} />
            <YAxis type="category" dataKey="name" width={130} tick={axis} />
            <Tooltip />
            <Bar dataKey="value" name="Tickets" fill="var(--primary)" />
          </BarChart>
        </Panel>
      </div>
    </div>
  );
}
