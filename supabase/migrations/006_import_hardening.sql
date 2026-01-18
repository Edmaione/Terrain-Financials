-- Harden imports and account-scoped metadata

UPDATE public.transactions
SET reviewed = false
WHERE reviewed IS NULL;

ALTER TABLE public.transactions
  ALTER COLUMN reviewed SET DEFAULT false,
  ALTER COLUMN reviewed SET NOT NULL;

UPDATE public.transactions
SET date = created_at::date
WHERE date IS NULL;

ALTER TABLE public.transactions
  ALTER COLUMN date SET NOT NULL;

CREATE INDEX IF NOT EXISTS import_mappings_header_fingerprint_idx
  ON public.import_mappings (header_fingerprint);

CREATE INDEX IF NOT EXISTS import_attempts_account_idx
  ON public.import_attempts (account_id);

CREATE INDEX IF NOT EXISTS import_attempts_header_fingerprint_idx
  ON public.import_attempts (header_fingerprint);

CREATE OR REPLACE FUNCTION public.account_access(account_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT auth.role() = 'service_role' OR auth.role() = 'authenticated';
$$;

ALTER TABLE public.import_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS import_mappings_authenticated_select ON public.import_mappings;
DROP POLICY IF EXISTS import_mappings_authenticated_write ON public.import_mappings;
DROP POLICY IF EXISTS import_mappings_account_access ON public.import_mappings;
DROP POLICY IF EXISTS import_attempts_authenticated_select ON public.import_attempts;
DROP POLICY IF EXISTS import_attempts_authenticated_write ON public.import_attempts;
DROP POLICY IF EXISTS import_attempts_account_access ON public.import_attempts;

CREATE POLICY import_mappings_account_access
  ON public.import_mappings
  FOR ALL
  USING (public.account_access(account_id))
  WITH CHECK (public.account_access(account_id));

CREATE POLICY import_attempts_account_access
  ON public.import_attempts
  FOR ALL
  USING (public.account_access(account_id))
  WITH CHECK (public.account_access(account_id));
