BEGIN;

create table if not exists account_import_mappings (
  id uuid primary key default gen_random_uuid(),
  institution text,
  statement_account_name text,
  account_number text,
  account_last4 text,
  header_signature text,
  account_id uuid not null references accounts(id),
  confidence numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists account_import_mappings_unique
on account_import_mappings (
  coalesce(institution,''),
  coalesce(statement_account_name,''),
  coalesce(account_number,''),
  coalesce(account_last4,''),
  coalesce(header_signature,'')
);

alter table imports
  add column if not exists detected_institution text,
  add column if not exists detected_account_last4 text,
  add column if not exists detected_account_number text,
  add column if not exists detected_statement_account_name text,
  add column if not exists detection_method text,          -- 'mapping_table' | 'header_match' | 'column_match' | 'manual'
  add column if not exists detection_confidence numeric,
  add column if not exists detection_reason text;

create table if not exists transaction_audit (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references transactions(id) on delete cascade,
  field text not null,
  old_value text,
  new_value text,
  changed_at timestamptz not null default now(),
  changed_by text
);

COMMIT;
