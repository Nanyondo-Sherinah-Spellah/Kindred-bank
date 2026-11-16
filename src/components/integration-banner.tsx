import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Info } from "lucide-react";
import { getIntegrationStatus } from "@/lib/cs.functions";

export function useIntegrations() {
  const fn = useServerFn(getIntegrationStatus);
  return useQuery({ queryKey: ["integrations"], queryFn: () => fn() });
}

export function DemoBanner({ connected, label }: { connected: boolean | undefined; label: string }) {
  return (
    <div className="mb-4 flex items-start gap-2 rounded-md border bg-accent px-4 py-3 text-sm text-accent-foreground">
      <Info className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <strong>{label}: {connected === undefined ? "checking…" : connected ? "connected" : "not connected"}.</strong>{" "}
        {connected
          ? "Replies you approve can be delivered through this service."
          : "You're in demonstration mode — messages are processed and logged, but nothing is delivered outside this app."}
      </div>
    </div>
  );
}
