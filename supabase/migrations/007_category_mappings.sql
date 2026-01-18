-- Category mapping layer for external labels -> internal categories

CREATE TABLE IF NOT EXISTS public.category_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  external_label TEXT NOT NULL,
  external_label_norm TEXT NOT NULL,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS category_mappings_account_label_idx
  ON public.category_mappings (account_id, external_label_norm);

CREATE INDEX IF NOT EXISTS category_mappings_account_idx
  ON public.category_mappings (account_id);

ALTER TABLE public.category_mappings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS category_mappings_account_access ON public.category_mappings;

CREATE POLICY category_mappings_account_access
  ON public.category_mappings
  FOR ALL
  USING (public.account_access(account_id))
  WITH CHECK (public.account_access(account_id));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_category_mappings_updated_at'
  ) THEN
    CREATE TRIGGER update_category_mappings_updated_at
    BEFORE UPDATE ON public.category_mappings
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END$$;
