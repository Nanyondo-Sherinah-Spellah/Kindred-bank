import { createServerFn } from "@tanstack/react-start";
import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayRunIdFetch } from "./ai/run-id";

type Msg = { role: "user" | "assistant"; content: string };

// Answers the admin's questions using only the ticket data the admin can already see.
export const askAdminAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { messages: Msg[] }) => ({
    messages: (input.messages ?? []).slice(-12).map((m) => ({
      role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
      content: String(m.content ?? "").slice(0, 2000),
    })),
  }))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured");

    const { data: tickets, error } = await context.supabase
      .from("escalations")
      .select("case_reference, channel, issue_category, priority, status, assigned_to, description, created_at")
      .order("created_at", { ascending: false })
      .limit(400);
    if (error) throw new Error(error.message);

    const rows = (tickets ?? [])
      .map((t) => `${t.created_at.slice(0, 16)} | ${t.case_reference ?? "-"} | ${t.channel} | ${t.issue_category} | ${t.priority} | ${t.status} | ${t.assigned_to ?? "unassigned"} | ${t.description.replace(/\s+/g, " ").slice(0, 160)}`)
      .join("\n");

    const instructions = `You are the analytics assistant for the Kindred Bank Customer Service Admin.
Answer only from the ticket data below. Count carefully. If the data cannot answer the question, say so plainly. Be concise; write plain text only (no markdown symbols, tables, asterisks or pipes); use simple "Label: value" lines or dash lists. Today is ${new Date().toISOString().slice(0, 10)}. Channel "voice" covers both the voice assistant and the website chatbot.

Tickets (${tickets?.length ?? 0}, newest first): created_at | case | channel | category | priority | status | assigned | description
${rows || "(none)"}`;

    const provider = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1",
      apiKey,
      headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
      fetch: createLovableAiGatewayRunIdFetch(undefined).fetch,
    });
    const result = streamText({
      model: provider.responses("openai/gpt-6-astra"),
      instructions,
      messages: data.messages,
      providerOptions: { openai: { store: false, reasoningEffort: "low" } },
    } as Parameters<typeof streamText>[0]);
    return { answer: await result.text };
  });
