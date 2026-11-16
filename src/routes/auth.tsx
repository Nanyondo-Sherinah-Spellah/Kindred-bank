import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Eye, EyeOff, Landmark, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Staff sign in — Kindred Bank" },
      { name: "description", content: "Sign in to the bank's customer service automation console." },
      { property: "og:title", content: "Staff sign in — Kindred Bank" },
      { property: "og:description", content: "Secure staff access to the customer service console." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/" });
    });
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/" });
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (data.session) navigate({ to: "/" });
        else setSent(true);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (r.error) toast.error(r.error.message ?? "Google sign-in failed");
    else if (!r.redirected) navigate({ to: "/" });
  }

  return (
    <div className="grid min-h-svh min-w-0 bg-background lg:grid-cols-2">
      <div className="flex min-w-0 flex-col justify-between gap-5 bg-primary px-5 py-6 text-primary-foreground sm:p-8 lg:p-12">
        <div className="flex items-center gap-2 font-display text-lg font-bold">
          <Landmark className="h-6 w-6 shrink-0" /> Kindred Bank
        </div>
        <div className="space-y-4">
          <h1 className="text-2xl font-bold leading-tight sm:text-3xl lg:text-4xl">
            Banking support, made simpler.<br />Here whenever you need us.
          </h1>
          <p className="max-w-md text-sm text-primary-foreground/80 sm:text-base">
            Get the answers you need through email, social media or voice. Our AI-powered assistants provide reliable
            guidance using approved banking information, while keeping your personal matters secure and connecting you
            to human support when needed.
          </p>
        </div>
        <p className="flex items-center gap-2 text-xs text-primary-foreground/60">
          <ShieldCheck className="h-4 w-4 shrink-0" /> Staff access only. Demonstration data is fictional.
        </p>
      </div>
      <div className="flex min-w-0 items-center justify-center px-5 py-8 sm:p-8">
        <div className="w-full min-w-0 max-w-sm space-y-6">
          <div>
            <h2 className="text-2xl font-bold">{mode === "signin" ? "Staff sign in" : "Create staff account"}</h2>
            <p className="text-sm text-muted-foreground">
              {mode === "signin" ? "Access the customer service console." : "The first account becomes the administrator."}
            </p>
          </div>
          {sent ? (
            <div className="break-words rounded-md border bg-accent p-4 text-sm text-accent-foreground">
              Check your inbox at <strong>{email}</strong> and click the confirmation link to finish signing up.
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Work email</Label>
                <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pr-10"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    type="button"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-0 top-1/2 h-11 w-11 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
              </Button>
            </form>
          )}
          <div className="relative text-center text-xs text-muted-foreground">
            <span className="bg-background px-2">or</span>
          </div>
          <Button variant="outline" className="w-full" onClick={google}>Continue with Google</Button>
          <p className="text-center text-sm text-muted-foreground">
            {mode === "signin" ? "New staff member?" : "Already registered?"}{" "}
            <button className="font-medium text-primary underline-offset-4 hover:underline" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setSent(false); }}>
              {mode === "signin" ? "Create an account" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
