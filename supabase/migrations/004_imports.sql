-- CSV imports tracking and idempotency

CREATE TABLE IF NOT EXISTS public.imports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL,
  created_by UUID NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  file_name TEXT,
  file_size BIGINT,
  file_sha256 TEXT,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'canceled')),
  canceled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  total_rows INT,
  processed_rows INT DEFAULT 0,
  inserted_rows INT DEFAULT 0,
  skipped_rows INT DEFAULT 0,
  error_rows INT DEFAULT 0,
  last_error TEXT
);

CREATE INDEX IF NOT EXISTS imports_account_id_created_at_idx
  ON public.imports (account_id, created_at DESC);

CREATE INDEX IF NOT EXISTS imports_status_idx
  ON public.imports (status);

CREATE UNIQUE INDEX IF NOT EXISTS imports_single_flight_idx
  ON public.imports (account_id, file_sha256)
  WHERE status IN ('queued', 'running');

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS import_id UUID REFERENCES public.imports(id),
  ADD COLUMN IF NOT EXISTS import_row_number INT,
  ADD COLUMN IF NOT EXISTS import_row_hash TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS transactions_import_row_hash_idx
  ON public.transactions (import_id, import_row_hash)
  WHERE import_id IS NOT NULL AND import_row_hash IS NOT NULL;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_imports_updated_at'
  ) THEN
    CREATE TRIGGER update_imports_updated_at
    BEFORE UPDATE ON public.imports
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END$$;
