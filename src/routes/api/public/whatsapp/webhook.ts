import { createFileRoute } from "@tanstack/react-router";
import { verifyWebhookRequest } from "@lovable.dev/webhooks-js";

export const Route = createFileRoute("/api/public/whatsapp/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["WHATSAPP_API_KEY"];
        if (!secret) return new Response("WhatsApp not configured", { status: 503 });
        let payload: unknown;
        try {
          ({ payload } = await verifyWebhookRequest({ req: request, secret, maxBodyBytes: 4 * 1024 * 1024 }));
        } catch {
          return new Response("Unauthorized", { status: 401 });
        }
        const deliveryId = request.headers.get("X-Lovable-Delivery")?.trim();
        const event = request.headers.get("X-Lovable-Event")?.trim();
        if (!deliveryId || !event) return new Response("Missing delivery headers", { status: 400 });
        try {
          const { handleWebhookDelivery } = await import("@/lib/whatsapp.server");
          const r = await handleWebhookDelivery(deliveryId, event, payload);
          return r.ok ? new Response("ok") : new Response("processing failed", { status: 500 });
        } catch (e) {
          console.error("WhatsApp webhook error:", e);
          return new Response("error", { status: 500 });
        }
      },
    },
  },
});
