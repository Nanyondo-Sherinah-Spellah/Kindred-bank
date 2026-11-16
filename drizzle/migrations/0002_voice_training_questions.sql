CREATE TABLE public.voice_training_questions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), question text NOT NULL,
 language text NOT NULL CHECK (language IN ('en','pcm','yo')),
 source_answer text NOT NULL, approved_answer text NOT NULL, topic text NOT NULL,
 keywords text[] NOT NULL DEFAULT '{}',
 intent text NOT NULL CHECK (intent IN ('general','personal_account','fraud','missing_funds','complaint')),
 sort_order integer NOT NULL DEFAULT 0, UNIQUE(question, language)
);
GRANT SELECT ON public.voice_training_questions TO authenticated;
GRANT ALL ON public.voice_training_questions TO service_role;
ALTER TABLE public.voice_training_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read voice training" ON public.voice_training_questions FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));