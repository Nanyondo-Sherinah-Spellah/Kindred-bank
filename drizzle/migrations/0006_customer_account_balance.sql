ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS account_number text;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS account_balance numeric;
CREATE UNIQUE INDEX IF NOT EXISTS customers_account_number_key ON public.customers (account_number);