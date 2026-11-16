
create type public.app_role as enum ('admin','agent');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;
create or replace function public.is_staff(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id)
$$;

create policy "Users see own roles; admins see all" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));

create or replace function public.handle_new_staff()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.user_roles where role = 'admin') then
    insert into public.user_roles(user_id, role) values (new.id, 'admin');
  end if;
  insert into public.user_roles(user_id, role) values (new.id, 'agent') on conflict do nothing;
  return new;
end $$;
create trigger on_auth_user_created_staff after insert on auth.users
  for each row execute function public.handle_new_staff();

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end $$;

-- Knowledge
create table public.knowledge (
  id uuid primary key default gen_random_uuid(),
  topic text not null,
  keywords text[] not null default '{}',
  approved_answer text not null,
  category text not null default 'General',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.knowledge to authenticated;
grant all on public.knowledge to service_role;
alter table public.knowledge enable row level security;
create policy "Staff read knowledge" on public.knowledge for select to authenticated using (public.is_staff(auth.uid()));
create policy "Staff insert knowledge" on public.knowledge for insert to authenticated with check (public.is_staff(auth.uid()));
create policy "Staff update knowledge" on public.knowledge for update to authenticated using (public.is_staff(auth.uid()));
create policy "Admins delete knowledge" on public.knowledge for delete to authenticated using (public.has_role(auth.uid(),'admin'));
create trigger knowledge_touch before update on public.knowledge for each row execute function public.touch_updated_at();

insert into public.knowledge (topic, keywords, approved_answer, category) values
('Business loan requirements', array['business loan','loan documents','requirements','apply for loan'],
 'A business loan applicant should prepare valid identification, proof of income and relevant business records. Final requirements depend on the loan product and assessment.', 'Loans'),
('Branch operating hours', array['branch hours','opening hours','closing time','working hours'],
 'Our branches operate Monday to Friday, 8:00 AM to 5:00 PM. Please contact your preferred branch to confirm public holiday arrangements.', 'Branches'),
('Account opening', array['open account','account registration','new account'],
 'To open an account, visit a bank branch with valid identification. Our customer service team can guide you through the requirements.', 'Accounts');

-- Customers (verification code is never granted to the browser)
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null unique,
  phone_number text,
  demo_verification_code text not null,
  next_repayment_date date,
  repayment_amount numeric(14,2),
  loan_status text not null default 'Active',
  created_at timestamptz not null default now()
);
grant select (id, full_name, email, phone_number, next_repayment_date, repayment_amount, loan_status, created_at) on public.customers to authenticated;
grant all on public.customers to service_role;
alter table public.customers enable row level security;
create policy "Staff read customers" on public.customers for select to authenticated using (public.is_staff(auth.uid()));

insert into public.customers (full_name, email, phone_number, demo_verification_code, next_repayment_date, repayment_amount, loan_status) values
('John Demo','john@example.com','+256 700 000 001','4821','2026-11-15',150000,'Active'),
('Mary Demo','mary@example.com','+256 700 000 002','7392','2026-11-20',250000,'Active');

-- Interaction logs
create table public.interaction_logs (
  id uuid primary key default gen_random_uuid(),
  "timestamp" timestamptz not null default now(),
  channel text not null check (channel in ('email','social','voice')),
  direction text not null check (direction in ('incoming','outgoing')),
  customer_email text,
  interaction_summary text not null,
  result text not null,
  case_reference text not null,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index on public.interaction_logs (created_at desc);
grant select, insert on public.interaction_logs to authenticated;
grant all on public.interaction_logs to service_role;
alter table public.interaction_logs enable row level security;
create policy "Staff read logs" on public.interaction_logs for select to authenticated using (public.is_staff(auth.uid()));
create policy "Staff insert logs" on public.interaction_logs for insert to authenticated with check (public.is_staff(auth.uid()));

-- Escalations
create table public.escalations (
  id uuid primary key default gen_random_uuid(),
  customer_email text,
  channel text not null,
  issue_category text not null,
  description text not null,
  priority text not null default 'medium' check (priority in ('low','medium','high','urgent')),
  status text not null default 'open' check (status in ('open','in_progress','resolved','closed')),
  assigned_to text,
  case_reference text,
  conversation_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.escalations to authenticated;
grant all on public.escalations to service_role;
alter table public.escalations enable row level security;
create policy "Staff read esc" on public.escalations for select to authenticated using (public.is_staff(auth.uid()));
create policy "Staff insert esc" on public.escalations for insert to authenticated with check (public.is_staff(auth.uid()));
create policy "Staff update esc" on public.escalations for update to authenticated using (public.is_staff(auth.uid()));
create trigger esc_touch before update on public.escalations for each row execute function public.touch_updated_at();

create table public.escalation_notes (
  id uuid primary key default gen_random_uuid(),
  escalation_id uuid not null references public.escalations(id) on delete cascade,
  author_id uuid not null default auth.uid(),
  author_email text,
  note text not null,
  created_at timestamptz not null default now()
);
grant select, insert on public.escalation_notes to authenticated;
grant all on public.escalation_notes to service_role;
alter table public.escalation_notes enable row level security;
create policy "Staff read notes" on public.escalation_notes for select to authenticated using (public.is_staff(auth.uid()));
create policy "Staff add notes" on public.escalation_notes for insert to authenticated with check (public.is_staff(auth.uid()) and author_id = auth.uid());

-- Email inbox
create table public.email_messages (
  id uuid primary key default gen_random_uuid(),
  sender text not null,
  subject text not null default '',
  body text not null,
  intent text,
  knowledge_id uuid references public.knowledge(id) on delete set null,
  draft_response text,
  final_response text,
  status text not null default 'pending_review',
  delivery_note text,
  case_reference text not null,
  escalation_id uuid references public.escalations(id) on delete set null,
  source text not null default 'demo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.email_messages to authenticated;
grant all on public.email_messages to service_role;
alter table public.email_messages enable row level security;
create policy "Staff all email sel" on public.email_messages for select to authenticated using (public.is_staff(auth.uid()));
create policy "Staff all email ins" on public.email_messages for insert to authenticated with check (public.is_staff(auth.uid()));
create policy "Staff all email upd" on public.email_messages for update to authenticated using (public.is_staff(auth.uid()));
create trigger email_touch before update on public.email_messages for each row execute function public.touch_updated_at();

-- Social messages
create table public.social_messages (
  id uuid primary key default gen_random_uuid(),
  platform text not null check (platform in ('facebook','instagram','tiktok')),
  message_type text not null check (message_type in ('comment','direct_message')),
  author_handle text not null,
  body text not null,
  intent text,
  action text,
  response text,
  status text not null default 'ready',
  delivery_note text,
  case_reference text not null,
  escalation_id uuid references public.escalations(id) on delete set null,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.social_messages to authenticated;
grant all on public.social_messages to service_role;
alter table public.social_messages enable row level security;
create policy "Staff social sel" on public.social_messages for select to authenticated using (public.is_staff(auth.uid()));
create policy "Staff social ins" on public.social_messages for insert to authenticated with check (public.is_staff(auth.uid()));
create policy "Staff social upd" on public.social_messages for update to authenticated using (public.is_staff(auth.uid()));

-- Voice sessions (state managed server-side)
create table public.voice_sessions (
  id uuid primary key default gen_random_uuid(),
  case_reference text not null,
  transcript jsonb not null default '[]'::jsonb,
  pending_action text,
  verification_attempts int not null default 0,
  verified_customer_email text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.voice_sessions to authenticated;
grant all on public.voice_sessions to service_role;
alter table public.voice_sessions enable row level security;
create policy "Staff voice sel" on public.voice_sessions for select to authenticated using (public.is_staff(auth.uid()));
create trigger voice_touch before update on public.voice_sessions for each row execute function public.touch_updated_at();

-- Settings
create table public.app_settings (
  id int primary key default 1 check (id = 1),
  bank_name text not null default 'Demo Microfinance Bank',
  email_auto_respond boolean not null default false,
  social_auto_reply boolean not null default false,
  secure_channel_text text not null default 'our secure private support channel (call +256 700 000 000 or visit any branch)',
  voice_recording_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);
grant select, update on public.app_settings to authenticated;
grant all on public.app_settings to service_role;
alter table public.app_settings enable row level security;
create policy "Staff read settings" on public.app_settings for select to authenticated using (public.is_staff(auth.uid()));
create policy "Admins update settings" on public.app_settings for update to authenticated using (public.has_role(auth.uid(),'admin'));
insert into public.app_settings (id) values (1);
