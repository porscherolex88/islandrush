ALTER TABLE "profiles" ADD COLUMN "signup_country" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "id_document_file_id" uuid;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "address_proof_file_id" uuid;--> statement-breakpoint
CREATE INDEX "profiles_signup_country_idx" ON "profiles" USING btree ("signup_country");--> statement-breakpoint
CREATE TABLE "admin_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"display_name" text NOT NULL,
	"role" "role" DEFAULT 'SUPER_ADMIN' NOT NULL,
	"status" "user_status" DEFAULT 'ACTIVE' NOT NULL,
	"must_change_password" boolean DEFAULT false NOT NULL,
	"failed_login_attempts" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "admin_accounts_username_uq" ON "admin_accounts" USING btree ("username");--> statement-breakpoint
CREATE TABLE "admin_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip" text,
	"user_agent" text,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admin_sessions" ADD CONSTRAINT "admin_sessions_admin_id_admin_accounts_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."admin_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "admin_sessions_token_uq" ON "admin_sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "admin_sessions_admin_idx" ON "admin_sessions" USING btree ("admin_id","expires_at");--> statement-breakpoint
CREATE TABLE "country_controls" (
	"country_code" text PRIMARY KEY NOT NULL,
	"site_access" boolean DEFAULT true NOT NULL,
	"free_play" boolean DEFAULT true NOT NULL,
	"deposits_enabled" boolean DEFAULT false NOT NULL,
	"withdrawals_enabled" boolean DEFAULT false NOT NULL,
	"bank_name" text,
	"bank_account_name" text,
	"bank_account_number" text,
	"bank_instructions" text,
	"qr_image_file_id" uuid,
	"usdt_trc20_address" text,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "country_controls" ADD CONSTRAINT "country_controls_qr_image_file_id_uploaded_files_id_fk" FOREIGN KEY ("qr_image_file_id") REFERENCES "public"."uploaded_files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "country_controls_updated_idx" ON "country_controls" USING btree ("updated_at");--> statement-breakpoint
ALTER TABLE "deposits" ALTER COLUMN "method" SET DEFAULT 'USDT_TRC20';--> statement-breakpoint
ALTER TABLE "deposits" ALTER COLUMN "payer_name" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "deposits" ADD COLUMN "country_code" text;--> statement-breakpoint
ALTER TABLE "deposits" ADD COLUMN "crypto_expected_amount" numeric(20, 6);--> statement-breakpoint
ALTER TABLE "deposits" ADD COLUMN "crypto_tx_id" text;--> statement-breakpoint
ALTER TABLE "deposits" ADD COLUMN "crypto_confirmations" integer;--> statement-breakpoint
ALTER TABLE "deposits" ADD COLUMN "crypto_to_address" text;--> statement-breakpoint
CREATE UNIQUE INDEX "deposits_crypto_txid_uq" ON "deposits" USING btree ("crypto_tx_id");--> statement-breakpoint
CREATE UNIQUE INDEX "deposits_crypto_expected_uq" ON "deposits" USING btree ("crypto_expected_amount");--> statement-breakpoint
CREATE INDEX "deposits_method_status_idx" ON "deposits" USING btree ("method","status");--> statement-breakpoint
ALTER TABLE "deposits" DROP CONSTRAINT IF EXISTS "deposits_reviewer_id_profiles_id_fk";--> statement-breakpoint
ALTER TABLE "withdrawals" DROP CONSTRAINT IF EXISTS "withdrawals_reviewer_id_profiles_id_fk";--> statement-breakpoint
CREATE TABLE "usdt_credit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deposit_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"tx_id" text NOT NULL,
	"from_address" text,
	"to_address" text NOT NULL,
	"amount" numeric(20, 6) NOT NULL,
	"confirmations" integer DEFAULT 0 NOT NULL,
	"credited_cash" numeric(20, 2) NOT NULL,
	"raw" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "usdt_credit_logs" ADD CONSTRAINT "usdt_credit_logs_deposit_id_deposits_id_fk" FOREIGN KEY ("deposit_id") REFERENCES "public"."deposits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usdt_credit_logs" ADD CONSTRAINT "usdt_credit_logs_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "usdt_credit_logs_txid_uq" ON "usdt_credit_logs" USING btree ("tx_id");--> statement-breakpoint
CREATE INDEX "usdt_credit_logs_deposit_idx" ON "usdt_credit_logs" USING btree ("deposit_id");--> statement-breakpoint
CREATE INDEX "usdt_credit_logs_created_idx" ON "usdt_credit_logs" USING btree ("created_at");--> statement-breakpoint
UPDATE "payment_accounts" SET "active" = false WHERE "bank_name" IN ('Maybank', 'CIMB Bank');--> statement-breakpoint
ALTER TABLE "uploaded_files" DROP CONSTRAINT IF EXISTS "uploaded_files_owner_id_profiles_id_fk";