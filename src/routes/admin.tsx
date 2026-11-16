import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Bot, Download, LayoutDashboard, Landmark, LogOut, Menu, Settings, Users, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/admin-login" });
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: data.user.id, _role: "admin" });
    if (!isAdmin) throw redirect({ to: "/admin-login" });
    return { user: data.user };
  },
  component: AdminLayout,
});

const NAV = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/assistant", label: "AI Assistant", icon: Bot, exact: false },
  { to: "/admin/download", label: "Download Data", icon: Download, exact: false },
  { to: "/admin/customers", label: "New Customers", icon: Users, exact: false },
  { to: "/admin/voice-test", label: "Voice Test", icon: Users, exact: false },
  { to: "/admin/settings", label: "Settings", icon: Settings, exact: false },
] as const;

function AdminLayout() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/admin-login", replace: true });
  }

  return (
    <div className="flex min-h-screen w-full bg-background">
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-60 flex-col bg-primary text-primary-foreground transition-transform md:static md:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center justify-between px-5 py-4 font-display font-bold">
          <span className="flex items-center gap-2"><Landmark className="h-5 w-5" /> Kindred Admin</span>
          <button className="md:hidden" aria-label="Close menu" onClick={() => setOpen(false)}><X className="h-5 w-5" /></button>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              onClick={() => setOpen(false)}
              activeOptions={{ exact: n.exact }}
              className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-primary-foreground/80 hover:bg-primary-foreground/10"
              activeProps={{ className: "bg-primary-foreground/15 font-semibold !text-primary-foreground" }}
            >
              <n.icon className="h-4 w-4" /> {n.label}
            </Link>
          ))}
        </nav>
        <button onClick={signOut} className="m-3 flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-primary-foreground/80 hover:bg-primary-foreground/10">
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </aside>
      {open && <div className="fixed inset-0 z-30 bg-foreground/40 md:hidden" onClick={() => setOpen(false)} />}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 border-b bg-card px-4 py-3 md:hidden">
          <Button variant="ghost" size="icon" aria-label="Open menu" onClick={() => setOpen(true)}><Menu className="h-5 w-5" /></Button>
          <span className="font-display font-bold text-primary">Kindred Admin</span>
        </header>
        <main className="mx-auto w-full min-w-0 max-w-6xl flex-1 px-4 py-6 sm:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
