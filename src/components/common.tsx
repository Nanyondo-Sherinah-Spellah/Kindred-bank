import type { ReactNode } from "react";
import { Mail, MessageCircle, Phone, Inbox } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold text-foreground">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ title, hint, icon }: { title: string; hint?: string; icon?: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col items-center justify-center rounded-lg border border-dashed p-5 text-center sm:p-10">
      <div className="mb-3 text-muted-foreground">{icon ?? <Inbox className="h-8 w-8" />}</div>
      <p className="font-medium">{title}</p>
      {hint && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function ChannelBadge({ channel }: { channel: string }) {
  const Icon = channel === "email" ? Mail : channel === "voice" ? Phone : MessageCircle;
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5 text-xs font-medium capitalize text-secondary-foreground">
      <Icon className="h-3 w-3" /> {channel}
    </span>
  );
}

const tone: Record<string, string> = {
  good: "border-success/30 bg-success/10 text-success",
  warn: "border-warning/40 bg-warning/15 text-foreground",
  bad: "border-destructive/30 bg-destructive/10 text-destructive",
  info: "border-teal/30 bg-accent text-accent-foreground",
  muted: "border-border bg-muted text-muted-foreground",
};

export function StatusPill({ label, kind = "muted" }: { label: string; kind?: keyof typeof tone }) {
  return <Badge variant="outline" className={cn("max-w-full whitespace-normal break-words font-medium", tone[kind])}>{label}</Badge>;
}

export function resultKind(r: string): keyof typeof tone {
  if (/escalat|failed|urgent/.test(r)) return "bad";
  if (/redirect|pending|not_sent|verification|high/.test(r)) return "warn";
  if (/sent|answer|resolved|verified|public_reply|closed/.test(r)) return "good";
  if (/intent|received|greet/.test(r)) return "info";
  return "muted";
}

export const pretty = (s: string) => s.replace(/^intent:/, "intent: ").replace(/_/g, " ");

export function fmt(ts: string) {
  return new Date(ts).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function Loading({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-12 animate-pulse rounded-md bg-muted" />
      ))}
    </div>
  );
}
