CREATE TABLE public.bank_applications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), reference text UNIQUE NOT NULL DEFAULT ('APP-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,10))), full_name text NOT NULL, email text NOT NULL, phone text NOT NULL, channel text NOT NULL DEFAULT 'chat', details jsonb NOT NULL DEFAULT '{}'::jsonb, documents jsonb NOT NULL DEFAULT '{}'::jsonb, status text NOT NULL DEFAULT 'awaiting_email', is_fictional boolean NOT NULL DEFAULT true CHECK (is_fictional = true), email_verified_at timestamptz, identity_status text NOT NULL DEFAULT 'not_checked', created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.bank_applications TO authenticated;
GRANT ALL ON public.bank_applications TO service_role;
ALTER TABLE public.bank_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read bank applications" ON public.bank_applications FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TABLE public.bank_application_access (
 application_id uuid PRIMARY KEY REFERENCES public.bank_applications(id) ON DELETE CASCADE, token_hash text NOT NULL, code_hash text NOT NULL, expires_at timestamptz NOT NULL, attempts integer NOT NULL DEFAULT 0, email_sent boolean NOT NULL DEFAULT false
);
GRANT ALL ON public.bank_application_access TO service_role;
ALTER TABLE public.bank_application_access ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.bank_accounts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), application_id uuid NOT NULL REFERENCES public.bank_applications(id), customer_id uuid NOT NULL REFERENCES public.customers(id), account_number text NOT NULL UNIQUE, product text NOT NULL, holder_name text NOT NULL, opening_deposit numeric NOT NULL DEFAULT 0, status text NOT NULL DEFAULT 'active_test', created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(application_id,product)
);
GRANT SELECT ON public.bank_accounts TO authenticated;
GRANT ALL ON public.bank_accounts TO service_role;
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read fictional accounts" ON public.bank_accounts FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE FUNCTION public.complete_test_application(p_id uuid, p_hash text, p_code_hash text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.bank_applications; v public.bank_application_access; c uuid; account_no text; item jsonb; results jsonb := '[]'::jsonb; demo_code text;
BEGIN
 SELECT * INTO v FROM public.bank_application_access WHERE application_id=p_id FOR UPDATE;
 IF NOT FOUND OR v.token_hash<>p_hash OR v.expires_at<=now() OR NOT v.email_sent THEN RETURN jsonb_build_object('error','Application unavailable or expired. Start again.'); END IF;
 IF v.attempts>=3 THEN RETURN jsonb_build_object('error','Email verification is locked after 3 incorrect attempts. Start again.'); END IF;
 SELECT * INTO a FROM public.bank_applications WHERE id=p_id FOR UPDATE;
 IF a.status='active_test' THEN RETURN jsonb_build_object('error','This application has already been completed.'); END IF;
 IF v.code_hash<>p_code_hash THEN UPDATE public.bank_application_access SET attempts=attempts+1 WHERE application_id=p_id; RETURN jsonb_build_object('error', 'Incorrect email code. ' || (2-v.attempts) || ' attempts left.'); END IF;
 demo_code := lpad(floor(random()*10000)::text,4,'0');
 SELECT id INTO c FROM public.customers WHERE email=a.email LIMIT 1;
 IF c IS NULL THEN
 account_no := '09' || lpad(nextval('public.fictional_account_numbers')::text,8,'0');
 INSERT INTO public.customers(full_name,email,phone_number,demo_verification_code,account_number,account_balance,loan_status) VALUES(a.full_name,a.email,a.phone,demo_code,account_no,0,'No loan') RETURNING id INTO c;
 ELSE RETURN jsonb_build_object('error','A fictional customer already exists for this email. Use another test email.'); END IF;
 FOR item IN SELECT * FROM jsonb_array_elements(a.details->'accounts') LOOP
 IF results<>'[]'::jsonb THEN account_no := '09' || lpad(nextval('public.fictional_account_numbers')::text,8,'0'); END IF;
 INSERT INTO public.bank_accounts(application_id,customer_id,account_number,product,holder_name,opening_deposit) VALUES(p_id,c,account_no,item->>'product',coalesce(nullif(item->>'holder',''),a.full_name),(item->>'deposit')::numeric);
 results := results || jsonb_build_array(jsonb_build_object('account_number',account_no,'product',item->>'product','holder',coalesce(nullif(item->>'holder',''),a.full_name)));
 END LOOP;
 UPDATE public.bank_applications SET status='active_test',email_verified_at=now(),identity_status='simulated_pass' WHERE id=p_id;
 UPDATE public.customers SET account_balance=(a.details->'accounts'->0->>'deposit')::numeric WHERE id=c;
 RETURN jsonb_build_object('accounts',results,'verification_code',demo_code,'reference',a.reference);
END $$;
CREATE SEQUENCE public.fictional_account_numbers START 100100;
REVOKE ALL ON FUNCTION public.complete_test_application(uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.complete_test_application(uuid,text,text) TO service_role;