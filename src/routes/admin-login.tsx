import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Eye, EyeOff, Landmark } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/admin-login")({
  head: () => ({
    meta: [
      { title: "Admin sign in — Kindred Bank" },
      { name: "description", content: "Customer Service Admin sign in." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Admin sign in — Kindred Bank" },
      { property: "og:description", content: "Customer Service Admin sign in." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminLogin,
});

function AdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: data.user.id, _role: "admin" });
      if (!isAdmin) {
        await supabase.auth.signOut();
        throw new Error("This account does not have admin access.");
      }
      navigate({ to: "/admin" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-primary px-4 py-8">
      <form onSubmit={submit} className="w-full max-w-sm space-y-5 rounded-lg bg-card p-6 text-card-foreground shadow-lg">
        <div className="flex items-center gap-2 font-display text-lg font-bold text-primary">
          <Landmark className="h-6 w-6" /> Kindred Bank Admin
        </div>
        <p className="text-sm text-muted-foreground">Customer Service Admin sign in.</p>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input id="password" type={show ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)} className="pr-10" />
            <Button type="button" variant="ghost" size="icon" aria-label={show ? "Hide password" : "Show password"} onClick={() => setShow((v) => !v)} className="absolute right-0 top-1/2 h-11 w-11 -translate-y-1/2 text-muted-foreground">
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        <Button type="submit" className="w-full" disabled={busy}>{busy ? "Please wait…" : "Sign in"}</Button>
      </form>
    </div>
  );
}
