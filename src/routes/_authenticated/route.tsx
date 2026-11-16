import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { DEFAULT_ASSISTANT_PATH, isAssistantPath } from "@/lib/access";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    // The console is limited to the email, social and voice assistants.
    if (!isAssistantPath(location.pathname)) {
      throw redirect({ to: DEFAULT_ASSISTANT_PATH, replace: true });
    }
    return { user: data.user };
  },
  component: AppShell,
});
