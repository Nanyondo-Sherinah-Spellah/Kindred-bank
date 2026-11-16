CREATE TABLE public.public_voice_access (session_id uuid PRIMARY KEY REFERENCES public.voice_sessions(id) ON DELETE CASCADE, token_hash text NOT NULL, expires_at timestamptz NOT NULL);
GRANT ALL ON public.public_voice_access TO service_role;
ALTER TABLE public.public_voice_access ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.public_voice_access IS 'Server-only capabilities for public voice sessions; no browser or staff read access.';