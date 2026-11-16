CREATE TABLE public.customer_device_access (token_hash text PRIMARY KEY, customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE, expires_at timestamptz NOT NULL);
GRANT ALL ON public.customer_device_access TO service_role;
ALTER TABLE public.customer_device_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_sessions ADD COLUMN recognized_customer_id uuid REFERENCES public.customers(id), ADD COLUMN resolution_state text NOT NULL DEFAULT 'pending', ADD COLUMN offer_shown boolean NOT NULL DEFAULT false;
CREATE OR REPLACE FUNCTION public.verify_voice_customer(p_session uuid, p_identity text, p_code text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.voice_sessions; c public.customers; attempts integer;
BEGIN
 SELECT * INTO s FROM public.voice_sessions WHERE id=p_session FOR UPDATE;
 IF NOT FOUND OR s.status<>'active' THEN RETURN jsonb_build_object('error','unavailable'); END IF;
 IF s.verification_attempts>=3 OR s.pending_action='balance_locked' THEN RETURN jsonb_build_object('error','locked'); END IF;
 SELECT * INTO c FROM public.customers WHERE demo_verification_code=p_code AND (account_number=p_identity OR regexp_replace(phone_number,'[^0-9]','','g')=p_identity OR id IN (SELECT customer_id FROM public.bank_accounts WHERE account_number=p_identity)) LIMIT 1;
 IF NOT FOUND THEN
 attempts := s.verification_attempts+1;
 UPDATE public.voice_sessions SET verification_attempts=attempts,pending_action=CASE WHEN attempts>=3 THEN 'balance_locked' ELSE 'verify_customer' END,resolution_state=CASE WHEN attempts>=3 THEN 'escalated' ELSE 'pending' END WHERE id=p_session;
 IF attempts>=3 THEN UPDATE public.escalations SET status='open',issue_category='Verification failed',priority='high',description='Customer failed identity verification three times.' WHERE case_reference=s.case_reference; END IF;
 RETURN jsonb_build_object('error',CASE WHEN attempts>=3 THEN 'locked' ELSE 'mismatch' END,'remaining',3-attempts);
 END IF;
 UPDATE public.voice_sessions SET recognized_customer_id=c.id,verified_customer_email=c.email,pending_action=NULL WHERE id=p_session;
 UPDATE public.escalations SET customer_email=c.email WHERE case_reference=s.case_reference;
 RETURN jsonb_build_object('customer_id',c.id,'first_name',split_part(c.full_name,' ',1));
END $$;
REVOKE ALL ON FUNCTION public.verify_voice_customer(uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.verify_voice_customer(uuid,text,text) TO service_role;
CREATE OR REPLACE FUNCTION public.resolve_voice_conversation(p_session uuid, p_end boolean, p_escalate boolean) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.voice_sessions; human_needed boolean; resolved boolean;
BEGIN
 SELECT * INTO s FROM public.voice_sessions WHERE id=p_session FOR UPDATE;
 IF NOT FOUND OR s.status<>'active' THEN RETURN jsonb_build_object('error','unavailable'); END IF;
 human_needed := p_escalate OR s.resolution_state='escalated';
 resolved := NOT human_needed AND s.resolution_state IN ('answered','resolved');
 UPDATE public.escalations SET status=CASE WHEN resolved THEN 'closed' ELSE 'open' END WHERE case_reference=s.case_reference;
 UPDATE public.voice_sessions SET resolution_state=CASE WHEN human_needed THEN 'escalated' WHEN resolved THEN 'resolved' ELSE resolution_state END,offer_shown=offer_shown OR resolved,status=CASE WHEN p_end THEN CASE WHEN human_needed THEN 'escalated' ELSE 'ended' END ELSE status END WHERE id=p_session;
 RETURN jsonb_build_object('resolved',resolved,'human_needed',human_needed,'offer',resolved AND NOT s.offer_shown AND s.verified_customer_email IS NOT NULL);
END $$;
REVOKE ALL ON FUNCTION public.resolve_voice_conversation(uuid,boolean,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_voice_conversation(uuid,boolean,boolean) TO service_role;