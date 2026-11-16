import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/admin/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Kindred Bank Admin" },
      { name: "description", content: "Admin account and automation settings." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Settings — Kindred Bank Admin" },
      { property: "og:description", content: "Admin account and automation settings." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const { data: s } = useQuery({
    queryKey: ["app-settings"],
    queryFn: async () => (await supabase.from("app_settings").select("*").eq("id", 1).maybeSingle()).data,
  });
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);

  async function toggle(field: "email_auto_respond" | "social_auto_reply", value: boolean) {
    const { error } = await supabase.from("app_settings").update(field === "email_auto_respond" ? { email_auto_respond: value } : { social_auto_reply: value }).eq("id", 1);
    if (error) toast.error(error.message);
    else { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["app-settings"] }); }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: next, current_password: current } as Parameters<typeof supabase.auth.updateUser>[0]);
    setBusy(false);
    if (error) toast.error(error.message);
    else { toast.success("Password changed"); setCurrent(""); setNext(""); }
  }

  return (
    <div className="max-w-2xl space-y-5">
      <h1 className="text-2xl font-bold">Settings</h1>
      <Card>
        <CardHeader><CardTitle className="text-base">Automatic replies</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div><p className="font-medium">Email auto-responder</p><p className="text-sm text-muted-foreground">Reply to emails automatically from approved answers.</p></div>
            <Switch checked={!!s?.email_auto_respond} disabled={!s} onCheckedChange={(v) => toggle("email_auto_respond", v)} />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div><p className="font-medium">Social media auto-reply</p><p className="text-sm text-muted-foreground">Reply to social media messages automatically.</p></div>
            <Switch checked={!!s?.social_auto_reply} disabled={!s} onCheckedChange={(v) => toggle("social_auto_reply", v)} />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Account</CardTitle></CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">Signed in as {user.email}</p>
          <form onSubmit={changePassword} className="space-y-3">
            <div className="space-y-2"><Label htmlFor="cur">Current password</Label><Input id="cur" type="password" required value={current} onChange={(e) => setCurrent(e.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="new">New password</Label><Input id="new" type="password" required minLength={8} value={next} onChange={(e) => setNext(e.target.value)} /></div>
            <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Change password"}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
