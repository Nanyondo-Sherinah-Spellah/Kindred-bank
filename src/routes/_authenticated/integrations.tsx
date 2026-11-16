import { createFileRoute } from "@tanstack/react-router";
import { Bot, Mail, MessageCircle, Phone } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, StatusPill } from "@/components/common";
import { useIntegrations } from "@/components/integration-banner";

export const Route = createFileRoute("/_authenticated/integrations")({
  head: () => ({ meta: [{ title: "Integrations — Kindred Bank" }, { name: "description", content: "Connection status for email, social media, WhatsApp and voice providers." }, { property: "og:title", content: "Integrations — Kindred Bank" }, { property: "og:description", content: "Connection status for email, social media, WhatsApp and voice providers." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: IntegrationsPage,
});

function IntegrationsPage() {
  const { data, isLoading } = useIntegrations();
  const s = (v: boolean | undefined, yes = "connected") =>
    isLoading ? <StatusPill label="checking" /> : v ? <StatusPill label={yes} kind="good" /> : <StatusPill label="not connected" kind="muted" />;

  const items = [
    { icon: Bot, name: "AI engine", status: s(data?.ai, "active"), body: "Intent detection and knowledge matching run on the server through Lovable AI. No setup needed. If the AI is unavailable, the system falls back to keyword matching and says so." },
    { icon: Mail, name: "Gmail", status: s(data?.gmail), body: "Sends approved replies from the bank's Gmail account. To connect: ask the builder to link the Gmail connector to this project. Incoming mail is currently entered through the demonstration form; automatic inbox polling needs this connection plus a sync job." },
    { icon: Mail, name: "Microsoft Outlook", status: s(data?.outlook, "credentials present"), body: "Alternative to Gmail. Requires linking the Outlook connector. Sending through Outlook is not yet wired in this build — only Gmail delivery is implemented." },
    { icon: MessageCircle, name: "Facebook Messenger & Instagram", status: s(data?.meta, "credentials present"), body: "Requires a Meta Business app with pages_messaging, instagram_manage_messages and pages_manage_engagement permissions (Meta app review), plus a Page access token stored as the server secret META_PAGE_ACCESS_TOKEN and a webhook. Until then replies are prepared and logged but not posted." },
    { icon: MessageCircle, name: "X (formerly Twitter)", status: s(data?.x, "credentials present"), body: "Requires X API access with a token stored as X_ACCESS_TOKEN. Until then replies are prepared and logged but not posted." },
    { icon: MessageCircle, name: "WhatsApp Business (+234 700 555 0188)", status: s(data?.whatsapp), body: "Incoming WhatsApp messages are answered automatically by the same assistant and knowledge base, and logged in the central history. Requires the WhatsApp Business connection to be linked and this project selected for incoming messages. Until then the WhatsApp button only opens a chat with the number; no automated replies are sent." },
    { icon: Phone, name: "Voice / telephone provider", status: s(data?.voiceProvider, "credentials present"), body: "A telephone number needs a provider such as Twilio (credentials stored as server secrets) and a call webhook. Today the assistant runs as an in-browser voice demonstration using your microphone and speakers." },
  ];

  return (
    <>
      <PageHeader title="Integrations" description="Statuses reflect credentials actually present on the server. Nothing is shown as connected unless it is." />
      <div className="grid gap-4 md:grid-cols-2">
        {items.map((i) => (
          <Card key={i.name}>
            <CardHeader className="flex-row items-center gap-3 space-y-0">
              <i.icon className="h-5 w-5 text-teal" /><CardTitle className="flex-1 text-base">{i.name}</CardTitle>{i.status}
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">{i.body}</CardContent>
          </Card>
        ))}
      </div>
      <p className="mt-6 text-xs text-muted-foreground">Credentials are stored only as encrypted server secrets and are never sent to the browser.</p>
    </>
  );
}
