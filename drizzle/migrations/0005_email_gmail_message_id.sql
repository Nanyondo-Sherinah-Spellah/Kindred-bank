ALTER TABLE public.email_messages ADD COLUMN IF NOT EXISTS gmail_message_id text;
CREATE UNIQUE INDEX IF NOT EXISTS email_messages_gmail_message_id_key ON public.email_messages (gmail_message_id);