-- Atomic CSV ingestion RPC and idempotency index

CREATE INDEX IF NOT EXISTS idx_transactions_source_source_hash
ON transactions(source, source_hash);

CREATE OR REPLACE FUNCTION ingest_csv_transactions(payload JSONB)
RETURNS JSONB AS $$
DECLARE
  inserted_count INTEGER := 0;
  updated_count INTEGER := 0;
  skipped_count INTEGER := 0;
  import_batch_id UUID;
  item JSONB;
  txn JSONB;
  payee_name TEXT;
  payee_display TEXT;
  payee_id UUID;
  transaction_id UUID;
  current_transaction_id UUID;
  has_splits BOOLEAN;
BEGIN
  INSERT INTO import_batches (source, metadata, created_by)
  VALUES (
    COALESCE((payload->>'source')::source_system, 'manual'::source_system),
    payload->'metadata',
    payload->>'created_by'
  )
  RETURNING id INTO import_batch_id;

  FOR item IN SELECT * FROM jsonb_array_elements(COALESCE(payload->'insert_transactions', '[]'::jsonb)) LOOP
    txn := item->'transaction';
    payee_name := COALESCE(txn->>'payee', '');
    payee_display := NULLIF(txn->>'payee_display', '');

    IF payee_name <> '' THEN
      INSERT INTO payees (name, display_name)
      VALUES (payee_name, payee_display)
      ON CONFLICT DO NOTHING;

      SELECT id INTO payee_id
      FROM payees
      WHERE lower(name) = lower(payee_name)
      LIMIT 1;
    ELSE
      payee_id := NULL;
    END IF;

    has_splits := jsonb_array_length(COALESCE(item->'splits', '[]'::jsonb)) > 0;

    INSERT INTO transactions (
      account_id,
      date,
      payee,
      payee_id,
      payee_original,
      payee_display,
      description,
      amount,
      reference,
      status,
      txn_status,
      is_transfer,
      ai_suggested_category,
      ai_confidence,
      review_status,
      reviewed,
      source,
      source_id,
      source_hash,
      import_batch_id,
      raw_csv_data,
      is_split
    )
    VALUES (
      (txn->>'account_id')::uuid,
      (txn->>'date')::date,
      NULLIF(txn->>'payee', ''),
      payee_id,
      NULLIF(txn->>'payee_original', ''),
      NULLIF(txn->>'payee_display', ''),
      NULLIF(txn->>'description', ''),
      NULLIF(txn->>'amount', '')::numeric,
      NULLIF(txn->>'reference', ''),
      NULLIF(txn->>'status', ''),
      COALESCE((txn->>'txn_status')::txn_status, 'posted'::txn_status),
      COALESCE((txn->>'is_transfer')::boolean, false),
      NULLIF(txn->>'ai_suggested_category', '')::uuid,
      NULLIF(txn->>'ai_confidence', '')::numeric,
      COALESCE((txn->>'review_status')::review_status, 'needs_review'::review_status),
      COALESCE((txn->>'reviewed')::boolean, false),
      COALESCE((txn->>'source')::source_system, 'manual'::source_system),
      NULLIF(txn->>'source_id', ''),
      NULLIF(txn->>'source_hash', ''),
      import_batch_id,
      txn->'raw_csv_data',
      has_splits
    )
    RETURNING id INTO transaction_id;

    IF has_splits THEN
      INSERT INTO transaction_splits (transaction_id, account_id, category_id, amount, memo)
      SELECT
        transaction_id,
        NULLIF(split->>'account_id', '')::uuid,
        NULLIF(split->>'category_id', '')::uuid,
        NULLIF(split->>'amount', '')::numeric,
        NULLIF(split->>'memo', '')
      FROM jsonb_array_elements(item->'splits') AS split;
    END IF;

    inserted_count := inserted_count + 1;
  END LOOP;

  FOR item IN SELECT * FROM jsonb_array_elements(COALESCE(payload->'update_transactions', '[]'::jsonb)) LOOP
    txn := item->'transaction';
    payee_name := COALESCE(txn->>'payee', '');
    payee_display := NULLIF(txn->>'payee_display', '');
    transaction_id := (item->>'id')::uuid;

    IF payee_name <> '' THEN
      INSERT INTO payees (name, display_name)
      VALUES (payee_name, payee_display)
      ON CONFLICT DO NOTHING;

      SELECT id INTO payee_id
      FROM payees
      WHERE lower(name) = lower(payee_name)
      LIMIT 1;
    ELSE
      payee_id := NULL;
    END IF;

    has_splits := jsonb_array_length(COALESCE(item->'splits', '[]'::jsonb)) > 0;

    UPDATE transactions
    SET
      account_id = (txn->>'account_id')::uuid,
      date = (txn->>'date')::date,
      payee = NULLIF(txn->>'payee', ''),
      payee_id = payee_id,
      payee_original = NULLIF(txn->>'payee_original', ''),
      payee_display = NULLIF(txn->>'payee_display', ''),
      description = NULLIF(txn->>'description', ''),
      amount = NULLIF(txn->>'amount', '')::numeric,
      reference = NULLIF(txn->>'reference', ''),
      status = NULLIF(txn->>'status', ''),
      txn_status = COALESCE((txn->>'txn_status')::txn_status, 'posted'::txn_status),
      is_transfer = COALESCE((txn->>'is_transfer')::boolean, false),
      ai_suggested_category = NULLIF(txn->>'ai_suggested_category', '')::uuid,
      ai_confidence = NULLIF(txn->>'ai_confidence', '')::numeric,
      review_status = COALESCE((txn->>'review_status')::review_status, 'needs_review'::review_status),
      reviewed = COALESCE((txn->>'reviewed')::boolean, false),
      source = COALESCE((txn->>'source')::source_system, 'manual'::source_system),
      source_id = NULLIF(txn->>'source_id', ''),
      source_hash = NULLIF(txn->>'source_hash', ''),
      import_batch_id = import_batch_id,
      raw_csv_data = txn->'raw_csv_data',
      is_split = CASE WHEN has_splits THEN true ELSE is_split END,
      updated_at = NOW()
    WHERE id = transaction_id;

    IF has_splits THEN
      current_transaction_id := transaction_id;
      DELETE FROM transaction_splits WHERE transaction_id = current_transaction_id;
      INSERT INTO transaction_splits (transaction_id, account_id, category_id, amount, memo)
      SELECT
        current_transaction_id,
        NULLIF(split->>'account_id', '')::uuid,
        NULLIF(split->>'category_id', '')::uuid,
        NULLIF(split->>'amount', '')::numeric,
        NULLIF(split->>'memo', '')
      FROM jsonb_array_elements(item->'splits') AS split;
    END IF;

    updated_count := updated_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'inserted', inserted_count,
    'updated', updated_count,
    'skipped', skipped_count,
    'import_batch_id', import_batch_id
  );
END;
$$ LANGUAGE plpgsql;
