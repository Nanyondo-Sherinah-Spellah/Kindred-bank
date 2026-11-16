import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const ticketsQuery = queryOptions({
  queryKey: ["admin-tickets"],
  queryFn: async () => {
    const { data, error } = await supabase.from("escalations").select("*").order("created_at", { ascending: false }).limit(1000);
    if (error) throw error;
    return data;
  },
  refetchInterval: 30000,
});

export const CHANNEL_LABEL: Record<string, string> = {
  voice: "Voice & Chatbot",
  email: "Email",
  social: "Social media",
  whatsapp: "WhatsApp",
};
