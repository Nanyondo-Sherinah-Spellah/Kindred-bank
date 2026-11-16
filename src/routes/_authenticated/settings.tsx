import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loading, PageHeader } from "@/components/common";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — Kindred Bank" }, { name: "description", content: "Bank details and automation preferences." }, { property: "og:title", content: "Settings — Kindred Bank" }, { property: "og:description", content: "Bank details and automation preferences." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: SettingsPage,
});

type S = { bank_name: string; email_auto_respond: boolean; social_auto_reply: boolean; secure_channel_text: string; voice_recording_enabled: boolean };

function SettingsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const [{ data: s }, { data: u }] = await Promise.all([supabase.from("app_settings").select("*").eq("id", 1).single(), supabase.auth.getUser()]);
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", u.user!.id);
      return { s: s as S, isAdmin: (roles ?? []).some((r) => r.role === "admin") };
    },
  });
  const [f, setF] = useState<S | null>(null);
  useEffect(() => { if (data) setF(data.s); }, [data]);

  async function save() {
    if (!f) return;
    const { error, count } = await supabase.from("app_settings").update({
      bank_name: f.bank_name.trim().slice(0, 120), secure_channel_text: f.secure_channel_text.trim().slice(0, 300),
      email_auto_respond: f.email_auto_respond, social_auto_reply: f.social_auto_reply, voice_recording_enabled: f.voice_recording_enabled,
    }, { count: "exact" }).eq("id", 1);
    if (error) { toast.error(error.message); return; }
    if (!count) { toast.error("Only administrators can change settings."); return; }
    toast.success("Settings saved");
    qc.invalidateQueries({ queryKey: ["settings"] });
  }

  if (isLoading || !f) return <><PageHeader title="Settings" /><Loading /></>;
  const ro = !data?.isAdmin;
  return (
    <>
      <PageHeader title="Settings" description={ro ? "View only — administrators can change these settings." : "Applies to every channel."} />
      <Card className="max-w-2xl">
        <CardHeader><CardTitle className="text-base">Bank & automation</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1"><Label>Bank name (used in replies)</Label><Input disabled={ro} value={f.bank_name} onChange={(e) => setF({ ...f, bank_name: e.target.value })} /></div>
          <div className="space-y-1"><Label>Secure private channel wording</Label><Input disabled={ro} value={f.secure_channel_text} onChange={(e) => setF({ ...f, secure_channel_text: e.target.value })} />
            <p className="text-xs text-muted-foreground">Inserted when personal enquiries are redirected: “…please contact our customer support team through <em>{f.secure_channel_text}</em>”.</p></div>
          <Row label="Email automatic response by default" hint="Matched answers are sent without staff review." checked={f.email_auto_respond} disabled={ro} onChange={(v) => setF({ ...f, email_auto_respond: v })} />
          <Row label="Voice recording disclosure" hint="Only turn on once audio recording is actually enabled and consent/legal requirements are met. The greeting will then announce recording." checked={f.voice_recording_enabled} disabled={ro} onChange={(v) => setF({ ...f, voice_recording_enabled: v })} />
          {!ro && <Button onClick={save}>Save settings</Button>}
        </CardContent>
      </Card>
    </>
  );
}

function Row({ label, hint, checked, disabled, onChange }: { label: string; hint: string; checked: boolean; disabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-md border p-3">
      <div><div className="text-sm font-medium">{label}</div><div className="text-xs text-muted-foreground">{hint}</div></div>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onChange} />
    </div>
  );
}
