


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "citext" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."account_class" AS ENUM (
    'asset',
    'liability',
    'equity',
    'income',
    'expense'
);


ALTER TYPE "public"."account_class" OWNER TO "postgres";


CREATE TYPE "public"."account_type" AS ENUM (
    'checking',
    'savings',
    'credit_card',
    'loan',
    'investment'
);


ALTER TYPE "public"."account_type" OWNER TO "postgres";


CREATE TYPE "public"."category_type" AS ENUM (
    'income',
    'cogs',
    'expense',
    'other_income',
    'other_expense'
);


ALTER TYPE "public"."category_type" OWNER TO "postgres";


CREATE TYPE "public"."job_status" AS ENUM (
    'active',
    'completed',
    'cancelled'
);


ALTER TYPE "public"."job_status" OWNER TO "postgres";


CREATE TYPE "public"."normal_balance" AS ENUM (
    'debit',
    'credit'
);


ALTER TYPE "public"."normal_balance" OWNER TO "postgres";


CREATE TYPE "public"."review_status" AS ENUM (
    'needs_review',
    'approved'
);


ALTER TYPE "public"."review_status" OWNER TO "postgres";


CREATE TYPE "public"."source_system" AS ENUM (
    'manual',
    'relay',
    'stripe',
    'gusto',
    'amex',
    'us_bank',
    'citi',
    'dcu',
    'sheffield',
    'other'
);


ALTER TYPE "public"."source_system" OWNER TO "postgres";


CREATE TYPE "public"."txn_status" AS ENUM (
    'draft',
    'posted',
    'void'
);


ALTER TYPE "public"."txn_status" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."account_access"("account_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT auth.role() = 'service_role' OR auth.role() = 'authenticated';
$$;


ALTER FUNCTION "public"."account_access"("account_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."block_transactions_inserts"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  raise exception 'Transactions inserts temporarily disabled';
end;
$$;


ALTER FUNCTION "public"."block_transactions_inserts"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."account_import_mappings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "institution" "text",
    "statement_account_name" "text",
    "account_number" "text",
    "account_last4" "text",
    "header_signature" "text",
    "account_id" "uuid" NOT NULL,
    "confidence" numeric,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."account_import_mappings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."accounts" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "account_number" "text",
    "type" "public"."account_type" NOT NULL,
    "institution" "text",
    "is_active" boolean DEFAULT true,
    "opening_balance" numeric(12,2) DEFAULT 0,
    "current_balance" numeric(12,2) DEFAULT 0,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "account_class" "public"."account_class",
    "account_subtype" "text",
    "normal_balance" "public"."normal_balance",
    "parent_id" "uuid",
    "last4" "text",
    "currency" "text" DEFAULT 'USD'::"text" NOT NULL,
    "opened_on" "date",
    "closed_on" "date",
    "terrain_account_code" "text",
    "tax_line" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "display_order" integer DEFAULT 0,
    "is_tax_deferred" boolean DEFAULT false
);


ALTER TABLE "public"."accounts" OWNER TO "postgres";


COMMENT ON TABLE "public"."accounts" IS 'Bank accounts, credit cards, loans tracked in the system';



CREATE TABLE IF NOT EXISTS "public"."categories" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "parent_id" "uuid",
    "type" "public"."category_type" NOT NULL,
    "section" "text",
    "is_tax_deductible" boolean DEFAULT true,
    "qb_equivalent" "text",
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "category_class" "public"."account_class",
    "is_cogs" boolean DEFAULT false NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "terrain_category_code" "text",
    "tax_line" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "tax_form_line" character varying(50),
    "tax_deduction_percentage" integer DEFAULT 100,
    "is_qbi_eligible" boolean DEFAULT false
);


ALTER TABLE "public"."categories" OWNER TO "postgres";


COMMENT ON TABLE "public"."categories" IS 'Chart of accounts matching QuickBooks structure';



CREATE TABLE IF NOT EXISTS "public"."categorization_rules" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "payee_pattern" "text" NOT NULL,
    "payee_pattern_normalized" "text",
    "description_pattern" "text",
    "category_id" "uuid" NOT NULL,
    "subcategory_id" "uuid",
    "confidence" numeric(3,2) DEFAULT 0.85,
    "times_applied" integer DEFAULT 0,
    "times_correct" integer DEFAULT 0,
    "times_wrong" integer DEFAULT 0,
    "last_used" timestamp with time zone,
    "created_by" "text" DEFAULT 'user'::"text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."categorization_rules" OWNER TO "postgres";


COMMENT ON TABLE "public"."categorization_rules" IS 'Rules for auto-categorizing transactions';



CREATE TABLE IF NOT EXISTS "public"."customers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying(255) NOT NULL,
    "email" character varying(255),
    "phone" character varying(50),
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."customers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."fixed_assets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying(255) NOT NULL,
    "asset_type" character varying(50) NOT NULL,
    "purchase_date" "date" NOT NULL,
    "purchase_price" numeric(12,2) NOT NULL,
    "depreciation_method" character varying(50),
    "useful_life_years" integer,
    "salvage_value" numeric(12,2) DEFAULT 0,
    "accumulated_depreciation" numeric(12,2) DEFAULT 0,
    "disposed_date" "date",
    "disposition_type" character varying(50),
    "disposition_amount" numeric(12,2),
    "notes" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."fixed_assets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."import_attempts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "account_id" "uuid" NOT NULL,
    "import_id" "uuid" NOT NULL,
    "filename" "text",
    "header_fingerprint" "text" NOT NULL,
    "mapping_id" "uuid",
    "mapping" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."import_attempts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."import_batches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "source" "public"."source_system" DEFAULT 'manual'::"public"."source_system" NOT NULL,
    "label" "text",
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "finished_at" timestamp with time zone,
    "stats" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL
);


ALTER TABLE "public"."import_batches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."import_mappings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "account_id" "uuid" NOT NULL,
    "mapping_name" "text",
    "source" "text",
    "header_fingerprint" "text" NOT NULL,
    "mapping" "jsonb" NOT NULL,
    "amount_strategy" "text" DEFAULT 'signed'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "import_mappings_amount_strategy_chk" CHECK (("amount_strategy" = ANY (ARRAY['signed'::"text", 'inflow_outflow'::"text"])))
);


ALTER TABLE "public"."import_mappings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."import_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "institution" "text" NOT NULL,
    "header_signature" "text" NOT NULL,
    "column_map" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "transforms" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "status_map" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."import_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."import_row_issues" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "import_id" "uuid" NOT NULL,
    "row_number" integer,
    "severity" "text" NOT NULL,
    "message" "text" NOT NULL,
    "raw_row" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."import_row_issues" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."imports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "account_id" "uuid" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "file_name" "text",
    "file_size" bigint,
    "file_sha256" "text",
    "status" "text" DEFAULT 'queued'::"text" NOT NULL,
    "canceled_at" timestamp with time zone,
    "started_at" timestamp with time zone,
    "finished_at" timestamp with time zone,
    "total_rows" integer,
    "processed_rows" integer DEFAULT 0 NOT NULL,
    "inserted_rows" integer DEFAULT 0 NOT NULL,
    "skipped_rows" integer DEFAULT 0 NOT NULL,
    "error_rows" integer DEFAULT 0 NOT NULL,
    "last_error" "text",
    "detected_institution" "text",
    "detected_account_last4" "text",
    "detected_account_number" "text",
    "detected_statement_account_name" "text",
    "detection_method" "text",
    "detection_confidence" numeric,
    "detection_reason" "text",
    "profile_id" "uuid",
    "preflight" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    CONSTRAINT "imports_status_check" CHECK (("status" = ANY (ARRAY['queued'::"text", 'running'::"text", 'succeeded'::"text", 'failed'::"text", 'canceled'::"text"])))
);


ALTER TABLE "public"."imports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."jobs" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "customer_name" "text" NOT NULL,
    "job_name" "text",
    "terrain_id" "text",
    "status" "public"."job_status" DEFAULT 'active'::"public"."job_status",
    "quoted_amount" numeric(12,2),
    "actual_revenue" numeric(12,2) DEFAULT 0,
    "actual_expenses" numeric(12,2) DEFAULT 0,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "external_job_id" "text",
    "started_on" "date",
    "completed_on" "date",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL
);


ALTER TABLE "public"."jobs" OWNER TO "postgres";


COMMENT ON TABLE "public"."jobs" IS 'Simple customer/project tracking for job costing';



CREATE TABLE IF NOT EXISTS "public"."owner_equity_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "transaction_id" "uuid",
    "equity_type" character varying(50) NOT NULL,
    "amount" numeric(12,2) NOT NULL,
    "date" "date" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "owner_equity_transactions_type_check" CHECK ((("equity_type")::"text" = ANY ((ARRAY['salary'::character varying, 'distribution'::character varying, 'contribution'::character varying, 'loan_to_company'::character varying, 'loan_from_company'::character varying])::"text"[])))
);


ALTER TABLE "public"."owner_equity_transactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payees" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "public"."citext" NOT NULL,
    "payee_type" "text",
    "external_ids" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."payees" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payroll_entries" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "gusto_id" "text",
    "pay_period_start" "date" NOT NULL,
    "pay_period_end" "date" NOT NULL,
    "pay_date" "date" NOT NULL,
    "gross_wages" numeric(12,2) NOT NULL,
    "payroll_taxes" numeric(12,2) NOT NULL,
    "net_pay" numeric(12,2) NOT NULL,
    "worker_comp" numeric(12,2) DEFAULT 0,
    "employee_name" "text",
    "department" "text",
    "raw_data" "jsonb",
    "imported_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "source" "public"."source_system" DEFAULT 'gusto'::"public"."source_system" NOT NULL,
    "source_run_id" "text",
    "period_start" "date",
    "period_end" "date",
    "employee_taxes" numeric(14,2),
    "employer_taxes" numeric(14,2),
    "deductions" numeric(14,2),
    "benefits" numeric(14,2),
    "is_cogs" boolean,
    "transaction_id" "uuid",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL
);


ALTER TABLE "public"."payroll_entries" OWNER TO "postgres";


COMMENT ON TABLE "public"."payroll_entries" IS 'Imported payroll data from Gusto';



CREATE TABLE IF NOT EXISTS "public"."review_actions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "transaction_id" "uuid" NOT NULL,
    "action" "text" NOT NULL,
    "before_json" "jsonb",
    "after_json" "jsonb",
    "actor" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."review_actions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stripe_payments" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "stripe_id" "text" NOT NULL,
    "customer_email" "text",
    "customer_name" "text",
    "amount" numeric(12,2) NOT NULL,
    "fee" numeric(12,2) NOT NULL,
    "net" numeric(12,2) NOT NULL,
    "payment_date" timestamp with time zone NOT NULL,
    "job_id" "uuid",
    "status" "text",
    "raw_data" "jsonb",
    "synced_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "balance_transaction_id" "text",
    "charge_id" "text",
    "payout_id" "text",
    "event_type" "text",
    "gross_amount" numeric(14,2),
    "fee_amount" numeric(14,2),
    "net_amount" numeric(14,2),
    "currency" "text" DEFAULT 'USD'::"text" NOT NULL,
    "transaction_id" "uuid",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL
);


ALTER TABLE "public"."stripe_payments" OWNER TO "postgres";


COMMENT ON TABLE "public"."stripe_payments" IS 'Customer payments from Stripe';



CREATE TABLE IF NOT EXISTS "public"."transaction_audit" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "transaction_id" "uuid" NOT NULL,
    "field" "text" NOT NULL,
    "old_value" "text",
    "new_value" "text",
    "changed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "changed_by" "text"
);


ALTER TABLE "public"."transaction_audit" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."transaction_import_staging" (
    "id" bigint NOT NULL,
    "date" "date" NOT NULL,
    "txn_type" "text",
    "account_name" "text" NOT NULL,
    "payee" "text" NOT NULL,
    "description" "text",
    "memo" "text",
    "amount" numeric(14,2) NOT NULL,
    "currency" "text" DEFAULT 'USD'::"text" NOT NULL,
    "category_name" "text",
    "category_type" "text",
    "subcategory_name" "text",
    "subcategory_type" "text",
    "is_transfer" boolean DEFAULT false NOT NULL,
    "transfer_to_account_name" "text",
    "payment_method" "text",
    "reference" "text",
    "status" "text",
    "review_status" "text",
    "source" "text",
    "source_id" "text",
    "payee_original" "text",
    "payee_display" "text",
    "imported_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "raw" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL
);


ALTER TABLE "public"."transaction_import_staging" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."transaction_import_staging_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."transaction_import_staging_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."transaction_import_staging_id_seq" OWNED BY "public"."transaction_import_staging"."id";



CREATE TABLE IF NOT EXISTS "public"."transaction_splits" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "transaction_id" "uuid" NOT NULL,
    "account_id" "uuid" NOT NULL,
    "category_id" "uuid",
    "payee_id" "uuid",
    "amount" numeric(14,2) NOT NULL,
    "line_memo" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."transaction_splits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."transactions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "account_id" "uuid" NOT NULL,
    "date" "date" NOT NULL,
    "payee" "text" NOT NULL,
    "description" "text",
    "amount" numeric(12,2) NOT NULL,
    "category_id" "uuid",
    "subcategory_id" "uuid",
    "job_id" "uuid",
    "is_transfer" boolean DEFAULT false,
    "transfer_to_account_id" "uuid",
    "payment_method" "text",
    "reference" "text",
    "status" character varying(20),
    "receipt_url" "text",
    "ai_suggested_category" "uuid",
    "ai_confidence" numeric(3,2),
    "reviewed" boolean DEFAULT false NOT NULL,
    "notes" "text",
    "raw_csv_data" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "reviewed_at" timestamp with time zone,
    "currency" "text" DEFAULT 'USD'::"text" NOT NULL,
    "txn_type" "text",
    "review_status" "public"."review_status" DEFAULT 'needs_review'::"public"."review_status" NOT NULL,
    "approved_at" timestamp with time zone,
    "approved_by" "text",
    "posted_at" timestamp with time zone,
    "cleared_at" timestamp with time zone,
    "imported_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "import_batch_id" "uuid",
    "source" "public"."source_system" DEFAULT 'manual'::"public"."source_system" NOT NULL,
    "source_id" "text",
    "source_hash" "text",
    "memo" "text",
    "payee_id" "uuid",
    "payee_original" "text",
    "payee_display" "text",
    "primary_category_id" "uuid",
    "transfer_group_id" "uuid",
    "is_split" boolean DEFAULT false NOT NULL,
    "reconciled" boolean DEFAULT false NOT NULL,
    "reconciled_at" timestamp with time zone,
    "confidence" numeric(3,2),
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "category_name" "text",
    "subcategory_name" "text",
    "import_id" "uuid",
    "import_row_number" integer,
    "import_row_hash" "text",
    "txn_status" "public"."txn_status" DEFAULT 'posted'::"public"."txn_status" NOT NULL,
    "paired_transaction_id" "uuid",
    "transfer_account_id" "uuid",
    "parent_transaction_id" "uuid",
    "split_percentage" numeric(5,2),
    "customer_id" "uuid",
    "vendor_id" "uuid",
    CONSTRAINT "transactions_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['pending'::character varying, 'posted'::character varying, 'reconciled'::character varying])::"text"[])))
);


ALTER TABLE "public"."transactions" OWNER TO "postgres";


COMMENT ON TABLE "public"."transactions" IS 'All financial transactions from all sources';



CREATE TABLE IF NOT EXISTS "public"."vendors" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying(255) NOT NULL,
    "category" character varying(100),
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."vendors" OWNER TO "postgres";


ALTER TABLE ONLY "public"."transaction_import_staging" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."transaction_import_staging_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."account_import_mappings"
    ADD CONSTRAINT "account_import_mappings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."accounts"
    ADD CONSTRAINT "accounts_name_unique" UNIQUE ("name");



ALTER TABLE ONLY "public"."accounts"
    ADD CONSTRAINT "accounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."categorization_rules"
    ADD CONSTRAINT "categorization_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fixed_assets"
    ADD CONSTRAINT "fixed_assets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."import_attempts"
    ADD CONSTRAINT "import_attempts_account_import_uq" UNIQUE ("account_id", "import_id");



ALTER TABLE ONLY "public"."import_attempts"
    ADD CONSTRAINT "import_attempts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."import_batches"
    ADD CONSTRAINT "import_batches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."import_mappings"
    ADD CONSTRAINT "import_mappings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."import_profiles"
    ADD CONSTRAINT "import_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."import_row_issues"
    ADD CONSTRAINT "import_row_issues_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."imports"
    ADD CONSTRAINT "imports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."jobs"
    ADD CONSTRAINT "jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."owner_equity_transactions"
    ADD CONSTRAINT "owner_equity_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payees"
    ADD CONSTRAINT "payees_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payroll_entries"
    ADD CONSTRAINT "payroll_entries_gusto_id_key" UNIQUE ("gusto_id");



ALTER TABLE ONLY "public"."payroll_entries"
    ADD CONSTRAINT "payroll_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."review_actions"
    ADD CONSTRAINT "review_actions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stripe_payments"
    ADD CONSTRAINT "stripe_payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stripe_payments"
    ADD CONSTRAINT "stripe_payments_stripe_id_key" UNIQUE ("stripe_id");



ALTER TABLE ONLY "public"."transaction_audit"
    ADD CONSTRAINT "transaction_audit_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."transaction_import_staging"
    ADD CONSTRAINT "transaction_import_staging_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."transaction_splits"
    ADD CONSTRAINT "transaction_splits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vendors"
    ADD CONSTRAINT "vendors_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."vendors"
    ADD CONSTRAINT "vendors_pkey" PRIMARY KEY ("id");



CREATE UNIQUE INDEX "account_import_mappings_unique" ON "public"."account_import_mappings" USING "btree" (COALESCE("institution", ''::"text"), COALESCE("statement_account_name", ''::"text"), COALESCE("account_number", ''::"text"), COALESCE("account_last4", ''::"text"), COALESCE("header_signature", ''::"text"));



CREATE INDEX "accounts_class_idx" ON "public"."accounts" USING "btree" ("account_class");



CREATE INDEX "accounts_parent_idx" ON "public"."accounts" USING "btree" ("parent_id");



CREATE INDEX "categories_is_cogs_idx" ON "public"."categories" USING "btree" ("is_cogs");



CREATE INDEX "categories_parent_id_idx" ON "public"."categories" USING "btree" ("parent_id");



CREATE INDEX "categories_parent_idx" ON "public"."categories" USING "btree" ("parent_id");



CREATE INDEX "idx_categorization_rules_payee" ON "public"."categorization_rules" USING "btree" ("payee_pattern");


CREATE INDEX IF NOT EXISTS "idx_categorization_rules_payee_norm" ON "public"."categorization_rules" USING "btree" ("payee_pattern_normalized");



CREATE INDEX "idx_fixed_assets_active" ON "public"."fixed_assets" USING "btree" ("is_active", "asset_type") WHERE ("is_active" = true);



CREATE INDEX "idx_review_actions_transaction" ON "public"."review_actions" USING "btree" ("transaction_id", "created_at" DESC);



CREATE INDEX "idx_stripe_payments_date" ON "public"."stripe_payments" USING "btree" ("payment_date" DESC);



CREATE INDEX "idx_transactions_account" ON "public"."transactions" USING "btree" ("account_id");



CREATE INDEX "idx_transactions_account_date" ON "public"."transactions" USING "btree" ("account_id", "date" DESC);



CREATE INDEX "idx_transactions_amount_range" ON "public"."transactions" USING "btree" ("amount") WHERE ("amount" < (0)::numeric);



CREATE INDEX "idx_transactions_category" ON "public"."transactions" USING "btree" ("category_id");



CREATE INDEX "idx_transactions_category_date" ON "public"."transactions" USING "btree" ("category_id", "date") WHERE ("category_id" IS NOT NULL);



CREATE INDEX "idx_transactions_customer" ON "public"."transactions" USING "btree" ("customer_id") WHERE ("customer_id" IS NOT NULL);



CREATE INDEX "idx_transactions_date" ON "public"."transactions" USING "btree" ("date" DESC);



CREATE INDEX "idx_transactions_paired" ON "public"."transactions" USING "btree" ("paired_transaction_id") WHERE ("paired_transaction_id" IS NOT NULL);



CREATE INDEX "idx_transactions_parent" ON "public"."transactions" USING "btree" ("parent_transaction_id") WHERE ("parent_transaction_id" IS NOT NULL);



CREATE INDEX "idx_transactions_payee" ON "public"."transactions" USING "btree" ("payee");



CREATE INDEX "idx_transactions_reviewed" ON "public"."transactions" USING "btree" ("reviewed") WHERE ("reviewed" = false);



CREATE INDEX "idx_transactions_tax_year" ON "public"."transactions" USING "btree" ("date", "category_id") WHERE ("reviewed" = true);



CREATE INDEX "idx_transactions_transfer" ON "public"."transactions" USING "btree" ("is_transfer", "account_id", "date") WHERE ("is_transfer" = true);



CREATE INDEX "idx_transactions_vendor" ON "public"."transactions" USING "btree" ("vendor_id") WHERE ("vendor_id" IS NOT NULL);



CREATE INDEX "import_attempts_account_idx" ON "public"."import_attempts" USING "btree" ("account_id");



CREATE INDEX "import_attempts_created_at_idx" ON "public"."import_attempts" USING "btree" ("created_at" DESC);



CREATE INDEX "import_attempts_header_fingerprint_idx" ON "public"."import_attempts" USING "btree" ("header_fingerprint");



CREATE UNIQUE INDEX "import_mappings_account_header_uq" ON "public"."import_mappings" USING "btree" ("account_id", "header_fingerprint");



CREATE INDEX "import_mappings_account_idx" ON "public"."import_mappings" USING "btree" ("account_id");



CREATE INDEX "import_mappings_header_fingerprint_idx" ON "public"."import_mappings" USING "btree" ("header_fingerprint");



CREATE UNIQUE INDEX "import_profiles_unique" ON "public"."import_profiles" USING "btree" ("institution", "header_signature");



CREATE INDEX "imports_account_id_created_at_idx" ON "public"."imports" USING "btree" ("account_id", "created_at" DESC);



CREATE UNIQUE INDEX "imports_single_flight_idx" ON "public"."imports" USING "btree" ("account_id", "file_sha256") WHERE ("status" = ANY (ARRAY['queued'::"text", 'running'::"text"]));



CREATE UNIQUE INDEX "imports_single_flight_uq" ON "public"."imports" USING "btree" ("account_id", "file_sha256") WHERE ("status" = ANY (ARRAY['queued'::"text", 'running'::"text"]));



CREATE INDEX "imports_status_idx" ON "public"."imports" USING "btree" ("status");



CREATE UNIQUE INDEX "payees_name_uq" ON "public"."payees" USING "btree" ("name");



CREATE INDEX "payroll_entries_pay_date_idx" ON "public"."payroll_entries" USING "btree" ("pay_date");



CREATE INDEX "review_actions_txn_idx" ON "public"."review_actions" USING "btree" ("transaction_id");



CREATE INDEX "splits_account_idx" ON "public"."transaction_splits" USING "btree" ("account_id");



CREATE INDEX "splits_category_idx" ON "public"."transaction_splits" USING "btree" ("category_id");



CREATE INDEX "splits_txn_idx" ON "public"."transaction_splits" USING "btree" ("transaction_id");



CREATE INDEX "stripe_payments_charge_idx" ON "public"."stripe_payments" USING "btree" ("charge_id");



CREATE INDEX "stripe_payments_payout_idx" ON "public"."stripe_payments" USING "btree" ("payout_id");



CREATE INDEX "transactions_account_date_idx" ON "public"."transactions" USING "btree" ("account_id", "date");



CREATE INDEX "transactions_category_name_idx" ON "public"."transactions" USING "btree" ("category_name");



CREATE INDEX "transactions_date_idx" ON "public"."transactions" USING "btree" ("date");



CREATE INDEX "transactions_payee_id_idx" ON "public"."transactions" USING "btree" ("payee_id");



CREATE INDEX "transactions_primary_category_idx" ON "public"."transactions" USING "btree" ("primary_category_id");



CREATE INDEX "transactions_source_idx" ON "public"."transactions" USING "btree" ("source", "source_id");



CREATE INDEX "transactions_subcategory_name_idx" ON "public"."transactions" USING "btree" ("subcategory_name");



CREATE INDEX "transactions_transfer_group_idx" ON "public"."transactions" USING "btree" ("transfer_group_id");



CREATE UNIQUE INDEX "transactions_uq_import_id_import_row_hash_all" ON "public"."transactions" USING "btree" ("import_id", "import_row_hash");



CREATE UNIQUE INDEX "transactions_uq_import_id_import_row_hash_full" ON "public"."transactions" USING "btree" ("import_id", "import_row_hash");



CREATE OR REPLACE TRIGGER "trg_block_transactions_inserts" BEFORE INSERT ON "public"."transactions" FOR EACH ROW EXECUTE FUNCTION "public"."block_transactions_inserts"();

ALTER TABLE "public"."transactions" DISABLE TRIGGER "trg_block_transactions_inserts";



CREATE OR REPLACE TRIGGER "trg_imports_set_updated_at" BEFORE UPDATE ON "public"."imports" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "update_accounts_updated_at" BEFORE UPDATE ON "public"."accounts" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_categories_updated_at" BEFORE UPDATE ON "public"."categories" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_imports_updated_at" BEFORE UPDATE ON "public"."imports" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "update_jobs_updated_at" BEFORE UPDATE ON "public"."jobs" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_transactions_updated_at" BEFORE UPDATE ON "public"."transactions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."account_import_mappings"
    ADD CONSTRAINT "account_import_mappings_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."categorization_rules"
    ADD CONSTRAINT "categorization_rules_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."categorization_rules"
    ADD CONSTRAINT "categorization_rules_subcategory_id_fkey" FOREIGN KEY ("subcategory_id") REFERENCES "public"."categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."import_attempts"
    ADD CONSTRAINT "import_attempts_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."import_attempts"
    ADD CONSTRAINT "import_attempts_mapping_id_fkey" FOREIGN KEY ("mapping_id") REFERENCES "public"."import_mappings"("id");



ALTER TABLE ONLY "public"."import_mappings"
    ADD CONSTRAINT "import_mappings_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."import_row_issues"
    ADD CONSTRAINT "import_row_issues_import_id_fkey" FOREIGN KEY ("import_id") REFERENCES "public"."imports"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."imports"
    ADD CONSTRAINT "imports_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."import_profiles"("id");



ALTER TABLE ONLY "public"."owner_equity_transactions"
    ADD CONSTRAINT "owner_equity_transactions_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id");



ALTER TABLE ONLY "public"."payroll_entries"
    ADD CONSTRAINT "payroll_entries_transaction_fkey" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id");



ALTER TABLE ONLY "public"."review_actions"
    ADD CONSTRAINT "review_actions_transaction_fkey" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transaction_splits"
    ADD CONSTRAINT "splits_account_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id");



ALTER TABLE ONLY "public"."transaction_splits"
    ADD CONSTRAINT "splits_category_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id");



ALTER TABLE ONLY "public"."transaction_splits"
    ADD CONSTRAINT "splits_payee_fkey" FOREIGN KEY ("payee_id") REFERENCES "public"."payees"("id");



ALTER TABLE ONLY "public"."transaction_splits"
    ADD CONSTRAINT "splits_transaction_fkey" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stripe_payments"
    ADD CONSTRAINT "stripe_payments_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."stripe_payments"
    ADD CONSTRAINT "stripe_payments_transaction_fkey" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id");



ALTER TABLE ONLY "public"."transaction_audit"
    ADD CONSTRAINT "transaction_audit_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_ai_suggested_category_fkey" FOREIGN KEY ("ai_suggested_category") REFERENCES "public"."categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id");



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_import_batch_fkey" FOREIGN KEY ("import_batch_id") REFERENCES "public"."import_batches"("id");



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_import_id_fkey" FOREIGN KEY ("import_id") REFERENCES "public"."imports"("id");



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_paired_transaction_id_fkey" FOREIGN KEY ("paired_transaction_id") REFERENCES "public"."transactions"("id");



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_parent_transaction_id_fkey" FOREIGN KEY ("parent_transaction_id") REFERENCES "public"."transactions"("id");



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_payee_id_fkey" FOREIGN KEY ("payee_id") REFERENCES "public"."payees"("id");



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_primary_category_fkey" FOREIGN KEY ("primary_category_id") REFERENCES "public"."categories"("id");



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_subcategory_id_fkey" FOREIGN KEY ("subcategory_id") REFERENCES "public"."categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_transfer_account_id_fkey" FOREIGN KEY ("transfer_account_id") REFERENCES "public"."accounts"("id");



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_transfer_to_account_id_fkey" FOREIGN KEY ("transfer_to_account_id") REFERENCES "public"."accounts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id");



ALTER TABLE "public"."import_attempts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "import_attempts_account_access" ON "public"."import_attempts" USING ("public"."account_access"("account_id")) WITH CHECK ("public"."account_access"("account_id"));



ALTER TABLE "public"."import_mappings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "import_mappings_account_access" ON "public"."import_mappings" USING ("public"."account_access"("account_id")) WITH CHECK ("public"."account_access"("account_id"));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."citextin"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."citextin"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."citextin"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."citextin"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."citextout"("public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."citextout"("public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."citextout"("public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."citextout"("public"."citext") TO "service_role";



GRANT ALL ON FUNCTION "public"."citextrecv"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."citextrecv"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."citextrecv"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."citextrecv"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."citextsend"("public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."citextsend"("public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."citextsend"("public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."citextsend"("public"."citext") TO "service_role";



GRANT ALL ON FUNCTION "public"."citext"(boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."citext"(boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."citext"(boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."citext"(boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."citext"(character) TO "postgres";
GRANT ALL ON FUNCTION "public"."citext"(character) TO "anon";
GRANT ALL ON FUNCTION "public"."citext"(character) TO "authenticated";
GRANT ALL ON FUNCTION "public"."citext"(character) TO "service_role";



GRANT ALL ON FUNCTION "public"."citext"("inet") TO "postgres";
GRANT ALL ON FUNCTION "public"."citext"("inet") TO "anon";
GRANT ALL ON FUNCTION "public"."citext"("inet") TO "authenticated";
GRANT ALL ON FUNCTION "public"."citext"("inet") TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."account_access"("account_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."account_access"("account_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."account_access"("account_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."block_transactions_inserts"() TO "anon";
GRANT ALL ON FUNCTION "public"."block_transactions_inserts"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."block_transactions_inserts"() TO "service_role";



GRANT ALL ON FUNCTION "public"."citext_cmp"("public"."citext", "public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."citext_cmp"("public"."citext", "public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."citext_cmp"("public"."citext", "public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."citext_cmp"("public"."citext", "public"."citext") TO "service_role";



GRANT ALL ON FUNCTION "public"."citext_eq"("public"."citext", "public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."citext_eq"("public"."citext", "public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."citext_eq"("public"."citext", "public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."citext_eq"("public"."citext", "public"."citext") TO "service_role";



GRANT ALL ON FUNCTION "public"."citext_ge"("public"."citext", "public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."citext_ge"("public"."citext", "public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."citext_ge"("public"."citext", "public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."citext_ge"("public"."citext", "public"."citext") TO "service_role";



GRANT ALL ON FUNCTION "public"."citext_gt"("public"."citext", "public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."citext_gt"("public"."citext", "public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."citext_gt"("public"."citext", "public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."citext_gt"("public"."citext", "public"."citext") TO "service_role";



GRANT ALL ON FUNCTION "public"."citext_hash"("public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."citext_hash"("public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."citext_hash"("public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."citext_hash"("public"."citext") TO "service_role";



GRANT ALL ON FUNCTION "public"."citext_hash_extended"("public"."citext", bigint) TO "postgres";
GRANT ALL ON FUNCTION "public"."citext_hash_extended"("public"."citext", bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."citext_hash_extended"("public"."citext", bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."citext_hash_extended"("public"."citext", bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."citext_larger"("public"."citext", "public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."citext_larger"("public"."citext", "public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."citext_larger"("public"."citext", "public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."citext_larger"("public"."citext", "public"."citext") TO "service_role";



GRANT ALL ON FUNCTION "public"."citext_le"("public"."citext", "public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."citext_le"("public"."citext", "public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."citext_le"("public"."citext", "public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."citext_le"("public"."citext", "public"."citext") TO "service_role";



GRANT ALL ON FUNCTION "public"."citext_lt"("public"."citext", "public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."citext_lt"("public"."citext", "public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."citext_lt"("public"."citext", "public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."citext_lt"("public"."citext", "public"."citext") TO "service_role";



GRANT ALL ON FUNCTION "public"."citext_ne"("public"."citext", "public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."citext_ne"("public"."citext", "public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."citext_ne"("public"."citext", "public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."citext_ne"("public"."citext", "public"."citext") TO "service_role";



GRANT ALL ON FUNCTION "public"."citext_pattern_cmp"("public"."citext", "public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."citext_pattern_cmp"("public"."citext", "public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."citext_pattern_cmp"("public"."citext", "public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."citext_pattern_cmp"("public"."citext", "public"."citext") TO "service_role";



GRANT ALL ON FUNCTION "public"."citext_pattern_ge"("public"."citext", "public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."citext_pattern_ge"("public"."citext", "public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."citext_pattern_ge"("public"."citext", "public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."citext_pattern_ge"("public"."citext", "public"."citext") TO "service_role";



GRANT ALL ON FUNCTION "public"."citext_pattern_gt"("public"."citext", "public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."citext_pattern_gt"("public"."citext", "public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."citext_pattern_gt"("public"."citext", "public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."citext_pattern_gt"("public"."citext", "public"."citext") TO "service_role";



GRANT ALL ON FUNCTION "public"."citext_pattern_le"("public"."citext", "public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."citext_pattern_le"("public"."citext", "public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."citext_pattern_le"("public"."citext", "public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."citext_pattern_le"("public"."citext", "public"."citext") TO "service_role";



GRANT ALL ON FUNCTION "public"."citext_pattern_lt"("public"."citext", "public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."citext_pattern_lt"("public"."citext", "public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."citext_pattern_lt"("public"."citext", "public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."citext_pattern_lt"("public"."citext", "public"."citext") TO "service_role";



GRANT ALL ON FUNCTION "public"."citext_smaller"("public"."citext", "public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."citext_smaller"("public"."citext", "public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."citext_smaller"("public"."citext", "public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."citext_smaller"("public"."citext", "public"."citext") TO "service_role";



GRANT ALL ON FUNCTION "public"."regexp_match"("public"."citext", "public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."regexp_match"("public"."citext", "public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."regexp_match"("public"."citext", "public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."regexp_match"("public"."citext", "public"."citext") TO "service_role";



GRANT ALL ON FUNCTION "public"."regexp_match"("public"."citext", "public"."citext", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."regexp_match"("public"."citext", "public"."citext", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."regexp_match"("public"."citext", "public"."citext", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."regexp_match"("public"."citext", "public"."citext", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."regexp_matches"("public"."citext", "public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."regexp_matches"("public"."citext", "public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."regexp_matches"("public"."citext", "public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."regexp_matches"("public"."citext", "public"."citext") TO "service_role";



GRANT ALL ON FUNCTION "public"."regexp_matches"("public"."citext", "public"."citext", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."regexp_matches"("public"."citext", "public"."citext", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."regexp_matches"("public"."citext", "public"."citext", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."regexp_matches"("public"."citext", "public"."citext", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."regexp_replace"("public"."citext", "public"."citext", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."regexp_replace"("public"."citext", "public"."citext", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."regexp_replace"("public"."citext", "public"."citext", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."regexp_replace"("public"."citext", "public"."citext", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."regexp_replace"("public"."citext", "public"."citext", "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."regexp_replace"("public"."citext", "public"."citext", "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."regexp_replace"("public"."citext", "public"."citext", "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."regexp_replace"("public"."citext", "public"."citext", "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."regexp_split_to_array"("public"."citext", "public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."regexp_split_to_array"("public"."citext", "public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."regexp_split_to_array"("public"."citext", "public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."regexp_split_to_array"("public"."citext", "public"."citext") TO "service_role";



GRANT ALL ON FUNCTION "public"."regexp_split_to_array"("public"."citext", "public"."citext", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."regexp_split_to_array"("public"."citext", "public"."citext", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."regexp_split_to_array"("public"."citext", "public"."citext", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."regexp_split_to_array"("public"."citext", "public"."citext", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."regexp_split_to_table"("public"."citext", "public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."regexp_split_to_table"("public"."citext", "public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."regexp_split_to_table"("public"."citext", "public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."regexp_split_to_table"("public"."citext", "public"."citext") TO "service_role";



GRANT ALL ON FUNCTION "public"."regexp_split_to_table"("public"."citext", "public"."citext", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."regexp_split_to_table"("public"."citext", "public"."citext", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."regexp_split_to_table"("public"."citext", "public"."citext", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."regexp_split_to_table"("public"."citext", "public"."citext", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."replace"("public"."citext", "public"."citext", "public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."replace"("public"."citext", "public"."citext", "public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."replace"("public"."citext", "public"."citext", "public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."replace"("public"."citext", "public"."citext", "public"."citext") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."split_part"("public"."citext", "public"."citext", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."split_part"("public"."citext", "public"."citext", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."split_part"("public"."citext", "public"."citext", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."split_part"("public"."citext", "public"."citext", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."strpos"("public"."citext", "public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."strpos"("public"."citext", "public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."strpos"("public"."citext", "public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strpos"("public"."citext", "public"."citext") TO "service_role";



GRANT ALL ON FUNCTION "public"."texticlike"("public"."citext", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."texticlike"("public"."citext", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."texticlike"("public"."citext", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."texticlike"("public"."citext", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."texticlike"("public"."citext", "public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."texticlike"("public"."citext", "public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."texticlike"("public"."citext", "public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."texticlike"("public"."citext", "public"."citext") TO "service_role";



GRANT ALL ON FUNCTION "public"."texticnlike"("public"."citext", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."texticnlike"("public"."citext", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."texticnlike"("public"."citext", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."texticnlike"("public"."citext", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."texticnlike"("public"."citext", "public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."texticnlike"("public"."citext", "public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."texticnlike"("public"."citext", "public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."texticnlike"("public"."citext", "public"."citext") TO "service_role";



GRANT ALL ON FUNCTION "public"."texticregexeq"("public"."citext", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."texticregexeq"("public"."citext", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."texticregexeq"("public"."citext", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."texticregexeq"("public"."citext", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."texticregexeq"("public"."citext", "public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."texticregexeq"("public"."citext", "public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."texticregexeq"("public"."citext", "public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."texticregexeq"("public"."citext", "public"."citext") TO "service_role";



GRANT ALL ON FUNCTION "public"."texticregexne"("public"."citext", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."texticregexne"("public"."citext", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."texticregexne"("public"."citext", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."texticregexne"("public"."citext", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."texticregexne"("public"."citext", "public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."texticregexne"("public"."citext", "public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."texticregexne"("public"."citext", "public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."texticregexne"("public"."citext", "public"."citext") TO "service_role";



GRANT ALL ON FUNCTION "public"."translate"("public"."citext", "public"."citext", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."translate"("public"."citext", "public"."citext", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."translate"("public"."citext", "public"."citext", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."translate"("public"."citext", "public"."citext", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";












GRANT ALL ON FUNCTION "public"."max"("public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."max"("public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."max"("public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."max"("public"."citext") TO "service_role";



GRANT ALL ON FUNCTION "public"."min"("public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."min"("public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."min"("public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."min"("public"."citext") TO "service_role";









GRANT ALL ON TABLE "public"."account_import_mappings" TO "anon";
GRANT ALL ON TABLE "public"."account_import_mappings" TO "authenticated";
GRANT ALL ON TABLE "public"."account_import_mappings" TO "service_role";



GRANT ALL ON TABLE "public"."accounts" TO "anon";
GRANT ALL ON TABLE "public"."accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."accounts" TO "service_role";



GRANT ALL ON TABLE "public"."categories" TO "anon";
GRANT ALL ON TABLE "public"."categories" TO "authenticated";
GRANT ALL ON TABLE "public"."categories" TO "service_role";



GRANT ALL ON TABLE "public"."categorization_rules" TO "anon";
GRANT ALL ON TABLE "public"."categorization_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."categorization_rules" TO "service_role";



GRANT ALL ON TABLE "public"."customers" TO "anon";
GRANT ALL ON TABLE "public"."customers" TO "authenticated";
GRANT ALL ON TABLE "public"."customers" TO "service_role";



GRANT ALL ON TABLE "public"."fixed_assets" TO "anon";
GRANT ALL ON TABLE "public"."fixed_assets" TO "authenticated";
GRANT ALL ON TABLE "public"."fixed_assets" TO "service_role";



GRANT ALL ON TABLE "public"."import_attempts" TO "anon";
GRANT ALL ON TABLE "public"."import_attempts" TO "authenticated";
GRANT ALL ON TABLE "public"."import_attempts" TO "service_role";



GRANT ALL ON TABLE "public"."import_batches" TO "anon";
GRANT ALL ON TABLE "public"."import_batches" TO "authenticated";
GRANT ALL ON TABLE "public"."import_batches" TO "service_role";



GRANT ALL ON TABLE "public"."import_mappings" TO "anon";
GRANT ALL ON TABLE "public"."import_mappings" TO "authenticated";
GRANT ALL ON TABLE "public"."import_mappings" TO "service_role";



GRANT ALL ON TABLE "public"."import_profiles" TO "anon";
GRANT ALL ON TABLE "public"."import_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."import_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."import_row_issues" TO "anon";
GRANT ALL ON TABLE "public"."import_row_issues" TO "authenticated";
GRANT ALL ON TABLE "public"."import_row_issues" TO "service_role";



GRANT ALL ON TABLE "public"."imports" TO "anon";
GRANT ALL ON TABLE "public"."imports" TO "authenticated";
GRANT ALL ON TABLE "public"."imports" TO "service_role";



GRANT ALL ON TABLE "public"."jobs" TO "anon";
GRANT ALL ON TABLE "public"."jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."jobs" TO "service_role";



GRANT ALL ON TABLE "public"."owner_equity_transactions" TO "anon";
GRANT ALL ON TABLE "public"."owner_equity_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."owner_equity_transactions" TO "service_role";



GRANT ALL ON TABLE "public"."payees" TO "anon";
GRANT ALL ON TABLE "public"."payees" TO "authenticated";
GRANT ALL ON TABLE "public"."payees" TO "service_role";



GRANT ALL ON TABLE "public"."payroll_entries" TO "anon";
GRANT ALL ON TABLE "public"."payroll_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."payroll_entries" TO "service_role";



GRANT ALL ON TABLE "public"."review_actions" TO "anon";
GRANT ALL ON TABLE "public"."review_actions" TO "authenticated";
GRANT ALL ON TABLE "public"."review_actions" TO "service_role";



GRANT ALL ON TABLE "public"."stripe_payments" TO "anon";
GRANT ALL ON TABLE "public"."stripe_payments" TO "authenticated";
GRANT ALL ON TABLE "public"."stripe_payments" TO "service_role";



GRANT ALL ON TABLE "public"."transaction_audit" TO "anon";
GRANT ALL ON TABLE "public"."transaction_audit" TO "authenticated";
GRANT ALL ON TABLE "public"."transaction_audit" TO "service_role";



GRANT ALL ON TABLE "public"."transaction_import_staging" TO "anon";
GRANT ALL ON TABLE "public"."transaction_import_staging" TO "authenticated";
GRANT ALL ON TABLE "public"."transaction_import_staging" TO "service_role";



GRANT ALL ON SEQUENCE "public"."transaction_import_staging_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."transaction_import_staging_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."transaction_import_staging_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."transaction_splits" TO "anon";
GRANT ALL ON TABLE "public"."transaction_splits" TO "authenticated";
GRANT ALL ON TABLE "public"."transaction_splits" TO "service_role";



GRANT ALL ON TABLE "public"."transactions" TO "anon";
GRANT ALL ON TABLE "public"."transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."transactions" TO "service_role";



GRANT ALL ON TABLE "public"."vendors" TO "anon";
GRANT ALL ON TABLE "public"."vendors" TO "authenticated";
GRANT ALL ON TABLE "public"."vendors" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































