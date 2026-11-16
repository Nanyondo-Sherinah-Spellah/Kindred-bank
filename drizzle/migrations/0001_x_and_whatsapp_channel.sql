ALTER TABLE public.social_messages DROP CONSTRAINT social_messages_platform_check;
DELETE FROM public.social_messages WHERE platform = 'tiktok';
ALTER TABLE public.social_messages ADD CONSTRAINT social_messages_platform_check CHECK (platform = ANY (ARRAY['facebook','instagram','x']));
ALTER TABLE public.interaction_logs DROP CONSTRAINT interaction_logs_channel_check;
ALTER TABLE public.interaction_logs ADD CONSTRAINT interaction_logs_channel_check CHECK (channel = ANY (ARRAY['email','social','voice','whatsapp']));

CREATE TABLE public.whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  direction text NOT NULL CHECK (direction IN ('incoming','outgoing')),
  phone text NOT NULL,
  body text NOT NULL,
  language text,
  intent text,
  wa_message_id text UNIQUE,
  reply_to text,
  status text NOT NULL DEFAULT 'received',
  status_at timestamptz,
  error text,
  case_reference text,
  source text NOT NULL DEFAULT 'staff_test',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.whatsapp_messages TO authenticated;
GRANT ALL ON public.whatsapp_messages TO service_role;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read whatsapp messages" ON public.whatsapp_messages FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

CREATE TABLE public.whatsapp_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id text NOT NULL UNIQUE,
  event text NOT NULL,
  payload jsonb NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  processing_error text,
  attempts int NOT NULL DEFAULT 0
);
GRANT SELECT ON public.whatsapp_webhook_events TO authenticated;
GRANT ALL ON public.whatsapp_webhook_events TO service_role;
ALTER TABLE public.whatsapp_webhook_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read whatsapp events" ON public.whatsapp_webhook_events FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE INDEX whatsapp_events_pending ON public.whatsapp_webhook_events (received_at) WHERE processed_at IS NULL;