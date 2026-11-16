import { Outlet, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/app-header";

export function AppShell() {
  const navigate = useNavigate();

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  return (
    <div className="flex min-h-screen min-w-0 flex-col bg-background">
      <AppHeader onSignOut={signOut} />
      <main className="mx-auto w-full min-w-0 max-w-7xl flex-1 px-3 py-4 sm:px-8 sm:py-6">
        <Outlet />
      </main>
    </div>
  );
}
