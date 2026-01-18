-- Manual import field mappings and attempts

CREATE TABLE IF NOT EXISTS public.import_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  mapping_name TEXT,
  source TEXT,
  header_fingerprint TEXT NOT NULL,
  mapping JSONB NOT NULL,
  amount_strategy TEXT NOT NULL DEFAULT 'signed' CHECK (amount_strategy IN ('signed', 'inflow_outflow')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS import_mappings_account_header_idx
  ON public.import_mappings (account_id, header_fingerprint);

CREATE INDEX IF NOT EXISTS import_mappings_account_idx
  ON public.import_mappings (account_id);

CREATE TABLE IF NOT EXISTS public.import_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  import_id UUID NOT NULL REFERENCES public.imports(id) ON DELETE CASCADE,
  filename TEXT,
  header_fingerprint TEXT NOT NULL,
  mapping_id UUID REFERENCES public.import_mappings(id),
  mapping JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS import_attempts_account_import_idx
  ON public.import_attempts (account_id, import_id);

ALTER TABLE public.import_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS import_mappings_authenticated_select ON public.import_mappings;
DROP POLICY IF EXISTS import_mappings_authenticated_write ON public.import_mappings;
DROP POLICY IF EXISTS import_attempts_authenticated_select ON public.import_attempts;
DROP POLICY IF EXISTS import_attempts_authenticated_write ON public.import_attempts;

CREATE POLICY import_mappings_authenticated_select
  ON public.import_mappings
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY import_mappings_authenticated_write
  ON public.import_mappings
  FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY import_attempts_authenticated_select
  ON public.import_attempts
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY import_attempts_authenticated_write
  ON public.import_attempts
  FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_import_mappings_updated_at'
  ) THEN
    CREATE TRIGGER update_import_mappings_updated_at
    BEFORE UPDATE ON public.import_mappings
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END$$;
