CREATE TYPE "public"."account_type" AS ENUM('CASH', 'CREDITS', 'PENDING_REWARDS', 'WITHDRAWABLE', 'WITHDRAWAL_PENDING', 'SYS_DEPOSIT_CLEARING', 'SYS_CONVERSION', 'SYS_CREDIT_ISSUANCE', 'SYS_GAME_REVENUE', 'SYS_REWARD_EXPENSE', 'SYS_REFERRAL_EXPENSE', 'SYS_PAYOUT', 'SYS_ADJUSTMENT');--> statement-breakpoint
CREATE TYPE "public"."achievement_condition" AS ENUM('BOXES_OPENED', 'TILES_DISCOVERED', 'AREAS_UNLOCKED', 'COLLECTIONS_COMPLETED', 'VAULTS_UNLOCKED', 'STREAK_DAYS', 'XP_LEVEL', 'ITEMS_COLLECTED');--> statement-breakpoint
CREATE TYPE "public"."banner_kind" AS ENUM('BANNER', 'ANNOUNCEMENT');--> statement-breakpoint
CREATE TYPE "public"."cash_reward_status" AS ENUM('PENDING', 'HELD', 'SETTLED', 'REVERSED');--> statement-breakpoint
CREATE TYPE "public"."content_status" AS ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED');--> statement-breakpoint
CREATE TYPE "public"."currency" AS ENUM('MYR', 'CREDITS');--> statement-breakpoint
CREATE TYPE "public"."deposit_status" AS ENUM('PENDING', 'APPROVED', 'REJECTED', 'REVERSED');--> statement-breakpoint
CREATE TYPE "public"."item_kind" AS ENUM('COLLECTIBLE', 'SPECIAL', 'KEY', 'FRAGMENT', 'COSMETIC');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('RUNNING', 'SUCCESS', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."ledger_tx_type" AS ENUM('DEPOSIT', 'DEPOSIT_REVERSAL', 'CONVERSION', 'GAME_SPEND', 'GAME_REWARD_CREDITS', 'CASH_REWARD', 'REFERRAL_REWARD', 'SETTLEMENT', 'REWARD_REVERSAL', 'WITHDRAWAL_REQUEST', 'WITHDRAWAL_COMPLETE', 'WITHDRAWAL_RETURN', 'ADJUSTMENT');--> statement-breakpoint
CREATE TYPE "public"."mission_action" AS ENUM('DAILY_LOGIN', 'DAILY_SPIN', 'OPEN_BOX', 'DISCOVER_TILE', 'CONVERT_CREDITS', 'DAILY_EVENT', 'UNLOCK_AREA', 'COLLECT_ITEM');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('REWARD', 'MISSION', 'COLLECTION', 'REFERRAL', 'WALLET', 'SYSTEM');--> statement-breakpoint
CREATE TYPE "public"."pool_mode" AS ENUM('WEIGHTED', 'ALL');--> statement-breakpoint
CREATE TYPE "public"."rarity" AS ENUM('COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY');--> statement-breakpoint
CREATE TYPE "public"."requirement_owner" AS ENUM('AREA', 'VAULT');--> statement-breakpoint
CREATE TYPE "public"."requirement_type" AS ENUM('ITEM', 'COLLECTION_COMPLETE', 'COLLECTION_PROGRESS', 'AREA_UNLOCKED', 'AREA_TILES', 'XP_LEVEL');--> statement-breakpoint
CREATE TYPE "public"."reward_source" AS ENUM('GAME_REWARD', 'REFERRAL_L1', 'REFERRAL_L2', 'REFERRAL_L3', 'ADJUSTMENT');--> statement-breakpoint
CREATE TYPE "public"."reward_type" AS ENUM('CREDITS', 'CASH', 'XP', 'ITEM', 'AREA_UNLOCK');--> statement-breakpoint
CREATE TYPE "public"."risk_severity" AS ENUM('LOW', 'MEDIUM', 'HIGH');--> statement-breakpoint
CREATE TYPE "public"."risk_status" AS ENUM('OPEN', 'IN_REVIEW', 'CLEARED', 'CONFIRMED');--> statement-breakpoint
CREATE TYPE "public"."risk_type" AS ENUM('SELF_REFERRAL', 'DUPLICATE_ACCOUNT', 'PAYMENT_METHOD_MATCH', 'DEVICE_MATCH', 'IP_MATCH', 'RAPID_SIGNUP', 'REFERRAL_VELOCITY', 'SUSPICIOUS_DEPOSIT', 'UNUSUAL_REWARD', 'UNUSUAL_WITHDRAWAL', 'MANUAL');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('USER', 'SUPPORT', 'FINANCE', 'GAME_ADMIN', 'SUPER_ADMIN');--> statement-breakpoint
CREATE TYPE "public"."ticket_priority" AS ENUM('LOW', 'NORMAL', 'HIGH', 'URGENT');--> statement-breakpoint
CREATE TYPE "public"."ticket_status" AS ENUM('OPEN', 'PENDING', 'RESOLVED', 'CLOSED');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('ACTIVE', 'SUSPENDED');--> statement-breakpoint
CREATE TYPE "public"."verification_status" AS ENUM('UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."withdrawal_status" AS ENUM('PENDING', 'REVIEW', 'APPROVED', 'PROCESSING', 'COMPLETED', 'REJECTED', 'CANCELLED');--> statement-breakpoint
CREATE TABLE "achievements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"condition" "achievement_condition" NOT NULL,
	"threshold" integer NOT NULL,
	"badge_name" text NOT NULL,
	"badge_icon" text DEFAULT '🏅' NOT NULL,
	"reward_pool_id" uuid,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_config" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"description" text,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "area_unlocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"area_id" uuid NOT NULL,
	"method" text DEFAULT 'REQUIREMENTS' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"actor_id" text,
	"actor_role" text,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"before" jsonb,
	"after" jsonb,
	"reason" text,
	"ip" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "banners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "banner_kind" DEFAULT 'BANNER' NOT NULL,
	"title" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"link" text,
	"status" "content_status" DEFAULT 'DRAFT' NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "broadcasts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"link" text,
	"audience" text DEFAULT 'ALL' NOT NULL,
	"status" "content_status" DEFAULT 'DRAFT' NOT NULL,
	"scheduled_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"recipient_count" integer DEFAULT 0 NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cash_rewards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"amount" numeric(20, 2) NOT NULL,
	"source" "reward_source" NOT NULL,
	"source_type" text NOT NULL,
	"source_id" text NOT NULL,
	"status" "cash_reward_status" DEFAULT 'PENDING' NOT NULL,
	"referee_id" text,
	"referral_level" integer,
	"deposit_id" uuid,
	"settle_after" timestamp with time zone NOT NULL,
	"held_reason" text,
	"credit_transaction_id" uuid,
	"settle_transaction_id" uuid,
	"reverse_transaction_id" uuid,
	"settled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collection_completions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"collection_id" uuid NOT NULL,
	"rewards" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"icon" text DEFAULT '🏝️' NOT NULL,
	"color" text DEFAULT '#6366f1' NOT NULL,
	"completion_reward_pool_id" uuid,
	"status" "content_status" DEFAULT 'PUBLISHED' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"status" "content_status" DEFAULT 'PUBLISHED' NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"cash_amount" numeric(20, 2) NOT NULL,
	"credits" bigint NOT NULL,
	"rate_cash" numeric(20, 2) NOT NULL,
	"rate_credits" bigint NOT NULL,
	"idempotency_key" text NOT NULL,
	"ledger_transaction_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_event_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"day" date NOT NULL,
	"credits_spent" bigint DEFAULT 0 NOT NULL,
	"reward" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_logins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"day" date NOT NULL,
	"streak_after" integer NOT NULL,
	"xp_awarded" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"day" date NOT NULL,
	"status" "content_status" DEFAULT 'DRAFT' NOT NULL,
	"spin_pool_id" uuid,
	"mission1_id" uuid,
	"mission2_id" uuid,
	"mission3_id" uuid,
	"mission_bonus_pool_id" uuid,
	"event_title" text,
	"event_description" text,
	"event_icon" text,
	"event_pool_id" uuid,
	"event_cost_credits" bigint DEFAULT 0 NOT NULL,
	"free_discoveries" integer,
	"teaser_title" text,
	"teaser_text" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_spins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"day" date NOT NULL,
	"pool_id" uuid,
	"pool_entry_id" uuid,
	"reward" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deposit_levels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer NOT NULL,
	"threshold" numeric(20, 2) NOT NULL,
	"color" text DEFAULT '#64748b' NOT NULL,
	"benefits" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"can_withdraw" boolean DEFAULT true NOT NULL,
	"withdrawal_min" numeric(20, 2),
	"withdrawal_max_daily" numeric(20, 2),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deposits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"amount" numeric(20, 2) NOT NULL,
	"method" text DEFAULT 'BANK_TRANSFER' NOT NULL,
	"payment_account_id" uuid,
	"reference" text NOT NULL,
	"payer_name" text NOT NULL,
	"user_note" text,
	"proof_file_id" uuid,
	"status" "deposit_status" DEFAULT 'PENDING' NOT NULL,
	"reviewer_id" text,
	"reviewed_at" timestamp with time zone,
	"review_note" text,
	"internal_note" text,
	"ledger_transaction_id" uuid,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deposits_amount_pos" CHECK ("deposits"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "faqs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question" text NOT NULL,
	"answer" text NOT NULL,
	"category" text DEFAULT 'General' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"status" "content_status" DEFAULT 'PUBLISHED' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feature_flags" (
	"key" text PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "financial_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"type" "account_type" NOT NULL,
	"currency" "currency" NOT NULL,
	"balance" numeric(20, 2) DEFAULT '0' NOT NULL,
	"allow_negative" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fa_non_negative" CHECK ("financial_accounts"."allow_negative" or "financial_accounts"."balance" >= 0)
);
--> statement-breakpoint
CREATE TABLE "help_articles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"body" text NOT NULL,
	"category" text DEFAULT 'General' NOT NULL,
	"status" "content_status" DEFAULT 'PUBLISHED' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory" (
	"user_id" text NOT NULL,
	"item_id" uuid NOT NULL,
	"quantity" integer DEFAULT 0 NOT NULL,
	"total_acquired" integer DEFAULT 0 NOT NULL,
	"first_acquired_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inventory_user_id_item_id_pk" PRIMARY KEY("user_id","item_id"),
	CONSTRAINT "inventory_qty_nonneg" CHECK ("inventory"."quantity" >= 0)
);
--> statement-breakpoint
CREATE TABLE "inventory_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"item_id" uuid NOT NULL,
	"delta" integer NOT NULL,
	"reason" text NOT NULL,
	"source_type" text NOT NULL,
	"source_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"icon" text DEFAULT '✨' NOT NULL,
	"kind" "item_kind" NOT NULL,
	"rarity" "rarity" DEFAULT 'COMMON' NOT NULL,
	"purpose" text NOT NULL,
	"effect" text DEFAULT '' NOT NULL,
	"collection_id" uuid,
	"assembles_into_item_id" uuid,
	"fragments_required" integer,
	"auto_assemble" boolean DEFAULT false NOT NULL,
	"status" "content_status" DEFAULT 'PUBLISHED' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job" text NOT NULL,
	"status" "job_status" DEFAULT 'RUNNING' NOT NULL,
	"triggered_by" text,
	"result" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "ledger_entries" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"transaction_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"user_id" text,
	"account_type" "account_type" NOT NULL,
	"currency" "currency" NOT NULL,
	"amount" numeric(20, 2) NOT NULL,
	"balance_after" numeric(20, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "le_nonzero" CHECK ("ledger_entries"."amount" <> 0)
);
--> statement-breakpoint
CREATE TABLE "ledger_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "ledger_tx_type" NOT NULL,
	"user_id" text,
	"idempotency_key" text NOT NULL,
	"description" text NOT NULL,
	"source_type" text,
	"source_id" text,
	"reward_source" "reward_source",
	"reverses_id" uuid,
	"created_by" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "login_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"email" text,
	"success" boolean NOT NULL,
	"ip" text,
	"user_agent" text,
	"device_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "map_areas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"map_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"icon" text DEFAULT '🏝️' NOT NULL,
	"color" text DEFAULT '#0ea5e9' NOT NULL,
	"is_special" boolean DEFAULT false NOT NULL,
	"discovery_cost_credits" bigint DEFAULT 0 NOT NULL,
	"discovery_pool_id" uuid,
	"unlock_reward_pool_id" uuid,
	"grid_cols" integer DEFAULT 4 NOT NULL,
	"grid_rows" integer DEFAULT 3 NOT NULL,
	"pos_x" integer DEFAULT 0 NOT NULL,
	"pos_y" integer DEFAULT 0 NOT NULL,
	"status" "content_status" DEFAULT 'PUBLISHED' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "map_tiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"area_id" uuid NOT NULL,
	"row" integer NOT NULL,
	"col" integer NOT NULL,
	"name" text NOT NULL,
	"icon" text DEFAULT '❔' NOT NULL,
	"cost_credits_override" bigint,
	"discovery_pool_id" uuid,
	"status" "content_status" DEFAULT 'PUBLISHED' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "maps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"status" "content_status" DEFAULT 'PUBLISHED' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mission_bonus_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"day" date NOT NULL,
	"rewards" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mission_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"title" text NOT NULL,
	"action" "mission_action" NOT NULL,
	"target" integer DEFAULT 1 NOT NULL,
	"icon" text DEFAULT '🎯' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "md_target_pos" CHECK ("mission_definitions"."target" > 0)
);
--> statement-breakpoint
CREATE TABLE "mission_progress" (
	"user_id" text NOT NULL,
	"day" date NOT NULL,
	"mission_id" uuid NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"completed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mission_progress_user_id_day_mission_id_pk" PRIMARY KEY("user_id","day","mission_id")
);
--> statement-breakpoint
CREATE TABLE "mystery_box_plays" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"box_id" uuid NOT NULL,
	"selected_index" integer NOT NULL,
	"credits_spent" bigint NOT NULL,
	"pool_entry_id" uuid,
	"reward" jsonb NOT NULL,
	"xp_awarded" integer DEFAULT 0 NOT NULL,
	"idempotency_key" text NOT NULL,
	"ledger_transaction_id" uuid,
	"app_day" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mbp_index_range" CHECK ("mystery_box_plays"."selected_index" between 0 and 8)
);
--> statement-breakpoint
CREATE TABLE "mystery_boxes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"price_credits" bigint NOT NULL,
	"reward_pool_id" uuid NOT NULL,
	"status" "content_status" DEFAULT 'PUBLISHED' NOT NULL,
	"daily_limit_per_user" integer,
	"total_limit" integer,
	"theme" jsonb DEFAULT '{"color":"#7c3aed","accent":"#f59e0b"}'::jsonb NOT NULL,
	"xp_reward" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mb_price_pos" CHECK ("mystery_boxes"."price_credits" > 0)
);
--> statement-breakpoint
CREATE TABLE "notification_templates" (
	"key" text PRIMARY KEY NOT NULL,
	"type" "notification_type" NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"type" "notification_type" NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"link" text,
	"read_at" timestamp with time zone,
	"broadcast_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bank_name" text NOT NULL,
	"account_name" text NOT NULL,
	"account_number" text NOT NULL,
	"instructions" text DEFAULT '' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"role" "role" DEFAULT 'USER' NOT NULL,
	"status" "user_status" DEFAULT 'ACTIVE' NOT NULL,
	"suspended_reason" text,
	"verification_status" "verification_status" DEFAULT 'UNVERIFIED' NOT NULL,
	"verification_required" boolean DEFAULT false NOT NULL,
	"verification_note" text,
	"referral_code" text NOT NULL,
	"referred_by_id" text,
	"rewards_on_hold" boolean DEFAULT false NOT NULL,
	"xp_total" integer DEFAULT 0 NOT NULL,
	"xp_level" integer DEFAULT 1 NOT NULL,
	"deposit_level_id" uuid,
	"total_deposits" numeric(20, 2) DEFAULT '0' NOT NULL,
	"notification_prefs" jsonb DEFAULT '{"rewards":true,"missions":true,"referrals":true,"system":true}'::jsonb NOT NULL,
	"play_limits" jsonb DEFAULT '{"dailyCreditLimit":null,"selfExcludedUntil":null}'::jsonb NOT NULL,
	"signup_ip" text,
	"signup_device_id" text,
	"last_seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"reset_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "referral_levels" (
	"level" integer PRIMARY KEY NOT NULL,
	"reward_kind" text DEFAULT 'FIXED' NOT NULL,
	"value" numeric(20, 2) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "requirements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_type" "requirement_owner" NOT NULL,
	"owner_id" uuid NOT NULL,
	"type" "requirement_type" NOT NULL,
	"label" text NOT NULL,
	"item_id" uuid,
	"collection_id" uuid,
	"area_id" uuid,
	"quantity" integer DEFAULT 1 NOT NULL,
	"consume" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reward_pool_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pool_id" uuid NOT NULL,
	"label" text NOT NULL,
	"reward_type" "reward_type" NOT NULL,
	"amount" numeric(20, 2) DEFAULT '0' NOT NULL,
	"item_id" uuid,
	"area_id" uuid,
	"rarity" "rarity" DEFAULT 'COMMON' NOT NULL,
	"weight" integer DEFAULT 1 NOT NULL,
	"max_awards" integer,
	"awarded_count" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"reveal" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rpe_weight_nonneg" CHECK ("reward_pool_entries"."weight" >= 0),
	CONSTRAINT "rpe_awarded_limit" CHECK ("reward_pool_entries"."max_awards" is null or "reward_pool_entries"."awarded_count" <= "reward_pool_entries"."max_awards")
);
--> statement-breakpoint
CREATE TABLE "reward_pools" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"mode" "pool_mode" DEFAULT 'WEIGHTED' NOT NULL,
	"status" "content_status" DEFAULT 'PUBLISHED' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "risk_flags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"related_user_id" text,
	"type" "risk_type" NOT NULL,
	"severity" "risk_severity" DEFAULT 'LOW' NOT NULL,
	"status" "risk_status" DEFAULT 'OPEN' NOT NULL,
	"summary" text NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"assigned_to_id" text,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "risk_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"flag_id" uuid NOT NULL,
	"author_id" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"role" "role" NOT NULL,
	"permission" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "role_permissions_role_permission_pk" PRIMARY KEY("role","permission")
);
--> statement-breakpoint
CREATE TABLE "streak_milestone_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"milestone_id" uuid NOT NULL,
	"run_start_day" date NOT NULL,
	"rewards" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "streak_milestones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"days" integer NOT NULL,
	"title" text NOT NULL,
	"reward_pool_id" uuid,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"author_id" text NOT NULL,
	"body" text NOT NULL,
	"is_internal" boolean DEFAULT false NOT NULL,
	"from_staff" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" bigserial NOT NULL,
	"user_id" text NOT NULL,
	"subject" text NOT NULL,
	"category" text DEFAULT 'GENERAL' NOT NULL,
	"status" "ticket_status" DEFAULT 'OPEN' NOT NULL,
	"priority" "ticket_priority" DEFAULT 'NORMAL' NOT NULL,
	"assigned_to_id" text,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"resolution" text,
	"last_message_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tile_discoveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"tile_id" uuid NOT NULL,
	"area_id" uuid NOT NULL,
	"credits_spent" bigint DEFAULT 0 NOT NULL,
	"used_free_discovery" boolean DEFAULT false NOT NULL,
	"reward" jsonb NOT NULL,
	"pool_entry_id" uuid,
	"ledger_transaction_id" uuid,
	"map_version" integer DEFAULT 1 NOT NULL,
	"app_day" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "uploaded_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"purpose" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"sha256" text NOT NULL,
	"data" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_achievements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"achievement_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"author_id" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_streaks" (
	"user_id" text PRIMARY KEY NOT NULL,
	"current" integer DEFAULT 0 NOT NULL,
	"longest" integer DEFAULT 0 NOT NULL,
	"last_claim_day" date,
	"run_start_day" date,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vault_unlocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"vault_id" uuid NOT NULL,
	"consumed" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"rewards" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vaults" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"icon" text DEFAULT '🏛️' NOT NULL,
	"map_id" uuid,
	"reward_pool_id" uuid,
	"status" "content_status" DEFAULT 'PUBLISHED' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "withdrawal_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"bank_name" text NOT NULL,
	"account_name" text NOT NULL,
	"account_number" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "withdrawals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"withdrawal_account_id" uuid NOT NULL,
	"amount" numeric(20, 2) NOT NULL,
	"status" "withdrawal_status" DEFAULT 'PENDING' NOT NULL,
	"account_snapshot" jsonb NOT NULL,
	"source_breakdown" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"reviewer_id" text,
	"review_note" text,
	"internal_note" text,
	"payout_reference" text,
	"idempotency_key" text NOT NULL,
	"request_transaction_id" uuid,
	"settle_transaction_id" uuid,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "withdrawals_amount_pos" CHECK ("withdrawals"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "xp_levels" (
	"level" integer PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"xp_required" integer NOT NULL,
	"reward_pool_id" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "xp_rules" (
	"source" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"amount" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "xp_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"amount" integer NOT NULL,
	"source" text NOT NULL,
	"source_id" text,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "achievements" ADD CONSTRAINT "achievements_reward_pool_id_reward_pools_id_fk" FOREIGN KEY ("reward_pool_id") REFERENCES "public"."reward_pools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "area_unlocks" ADD CONSTRAINT "area_unlocks_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "area_unlocks" ADD CONSTRAINT "area_unlocks_area_id_map_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."map_areas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broadcasts" ADD CONSTRAINT "broadcasts_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_rewards" ADD CONSTRAINT "cash_rewards_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_rewards" ADD CONSTRAINT "cash_rewards_referee_id_profiles_id_fk" FOREIGN KEY ("referee_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_rewards" ADD CONSTRAINT "cash_rewards_deposit_id_deposits_id_fk" FOREIGN KEY ("deposit_id") REFERENCES "public"."deposits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_rewards" ADD CONSTRAINT "cash_rewards_credit_transaction_id_ledger_transactions_id_fk" FOREIGN KEY ("credit_transaction_id") REFERENCES "public"."ledger_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_rewards" ADD CONSTRAINT "cash_rewards_settle_transaction_id_ledger_transactions_id_fk" FOREIGN KEY ("settle_transaction_id") REFERENCES "public"."ledger_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_rewards" ADD CONSTRAINT "cash_rewards_reverse_transaction_id_ledger_transactions_id_fk" FOREIGN KEY ("reverse_transaction_id") REFERENCES "public"."ledger_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_completions" ADD CONSTRAINT "collection_completions_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_completions" ADD CONSTRAINT "collection_completions_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_completion_reward_pool_id_reward_pools_id_fk" FOREIGN KEY ("completion_reward_pool_id") REFERENCES "public"."reward_pools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversions" ADD CONSTRAINT "conversions_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversions" ADD CONSTRAINT "conversions_ledger_transaction_id_ledger_transactions_id_fk" FOREIGN KEY ("ledger_transaction_id") REFERENCES "public"."ledger_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_event_claims" ADD CONSTRAINT "daily_event_claims_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_logins" ADD CONSTRAINT "daily_logins_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_schedules" ADD CONSTRAINT "daily_schedules_spin_pool_id_reward_pools_id_fk" FOREIGN KEY ("spin_pool_id") REFERENCES "public"."reward_pools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_schedules" ADD CONSTRAINT "daily_schedules_mission1_id_mission_definitions_id_fk" FOREIGN KEY ("mission1_id") REFERENCES "public"."mission_definitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_schedules" ADD CONSTRAINT "daily_schedules_mission2_id_mission_definitions_id_fk" FOREIGN KEY ("mission2_id") REFERENCES "public"."mission_definitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_schedules" ADD CONSTRAINT "daily_schedules_mission3_id_mission_definitions_id_fk" FOREIGN KEY ("mission3_id") REFERENCES "public"."mission_definitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_schedules" ADD CONSTRAINT "daily_schedules_mission_bonus_pool_id_reward_pools_id_fk" FOREIGN KEY ("mission_bonus_pool_id") REFERENCES "public"."reward_pools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_schedules" ADD CONSTRAINT "daily_schedules_event_pool_id_reward_pools_id_fk" FOREIGN KEY ("event_pool_id") REFERENCES "public"."reward_pools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_spins" ADD CONSTRAINT "daily_spins_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_spins" ADD CONSTRAINT "daily_spins_pool_id_reward_pools_id_fk" FOREIGN KEY ("pool_id") REFERENCES "public"."reward_pools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_spins" ADD CONSTRAINT "daily_spins_pool_entry_id_reward_pool_entries_id_fk" FOREIGN KEY ("pool_entry_id") REFERENCES "public"."reward_pool_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deposits" ADD CONSTRAINT "deposits_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deposits" ADD CONSTRAINT "deposits_payment_account_id_payment_accounts_id_fk" FOREIGN KEY ("payment_account_id") REFERENCES "public"."payment_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deposits" ADD CONSTRAINT "deposits_proof_file_id_uploaded_files_id_fk" FOREIGN KEY ("proof_file_id") REFERENCES "public"."uploaded_files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deposits" ADD CONSTRAINT "deposits_reviewer_id_profiles_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deposits" ADD CONSTRAINT "deposits_ledger_transaction_id_ledger_transactions_id_fk" FOREIGN KEY ("ledger_transaction_id") REFERENCES "public"."ledger_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_accounts" ADD CONSTRAINT "financial_accounts_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_events" ADD CONSTRAINT "inventory_events_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_events" ADD CONSTRAINT "inventory_events_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_transaction_id_ledger_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."ledger_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_account_id_financial_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."financial_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_transactions" ADD CONSTRAINT "ledger_transactions_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "login_events" ADD CONSTRAINT "login_events_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "map_areas" ADD CONSTRAINT "map_areas_map_id_maps_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."maps"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "map_areas" ADD CONSTRAINT "map_areas_discovery_pool_id_reward_pools_id_fk" FOREIGN KEY ("discovery_pool_id") REFERENCES "public"."reward_pools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "map_areas" ADD CONSTRAINT "map_areas_unlock_reward_pool_id_reward_pools_id_fk" FOREIGN KEY ("unlock_reward_pool_id") REFERENCES "public"."reward_pools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "map_tiles" ADD CONSTRAINT "map_tiles_area_id_map_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."map_areas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "map_tiles" ADD CONSTRAINT "map_tiles_discovery_pool_id_reward_pools_id_fk" FOREIGN KEY ("discovery_pool_id") REFERENCES "public"."reward_pools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mission_bonus_claims" ADD CONSTRAINT "mission_bonus_claims_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mission_progress" ADD CONSTRAINT "mission_progress_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mission_progress" ADD CONSTRAINT "mission_progress_mission_id_mission_definitions_id_fk" FOREIGN KEY ("mission_id") REFERENCES "public"."mission_definitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mystery_box_plays" ADD CONSTRAINT "mystery_box_plays_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mystery_box_plays" ADD CONSTRAINT "mystery_box_plays_box_id_mystery_boxes_id_fk" FOREIGN KEY ("box_id") REFERENCES "public"."mystery_boxes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mystery_box_plays" ADD CONSTRAINT "mystery_box_plays_pool_entry_id_reward_pool_entries_id_fk" FOREIGN KEY ("pool_entry_id") REFERENCES "public"."reward_pool_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mystery_box_plays" ADD CONSTRAINT "mystery_box_plays_ledger_transaction_id_ledger_transactions_id_fk" FOREIGN KEY ("ledger_transaction_id") REFERENCES "public"."ledger_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mystery_boxes" ADD CONSTRAINT "mystery_boxes_reward_pool_id_reward_pools_id_fk" FOREIGN KEY ("reward_pool_id") REFERENCES "public"."reward_pools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirements" ADD CONSTRAINT "requirements_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirements" ADD CONSTRAINT "requirements_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirements" ADD CONSTRAINT "requirements_area_id_map_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."map_areas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_pool_entries" ADD CONSTRAINT "reward_pool_entries_pool_id_reward_pools_id_fk" FOREIGN KEY ("pool_id") REFERENCES "public"."reward_pools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_flags" ADD CONSTRAINT "risk_flags_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_flags" ADD CONSTRAINT "risk_flags_related_user_id_profiles_id_fk" FOREIGN KEY ("related_user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_flags" ADD CONSTRAINT "risk_flags_assigned_to_id_profiles_id_fk" FOREIGN KEY ("assigned_to_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_notes" ADD CONSTRAINT "risk_notes_flag_id_risk_flags_id_fk" FOREIGN KEY ("flag_id") REFERENCES "public"."risk_flags"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_notes" ADD CONSTRAINT "risk_notes_author_id_profiles_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "streak_milestone_claims" ADD CONSTRAINT "streak_milestone_claims_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "streak_milestone_claims" ADD CONSTRAINT "streak_milestone_claims_milestone_id_streak_milestones_id_fk" FOREIGN KEY ("milestone_id") REFERENCES "public"."streak_milestones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "streak_milestones" ADD CONSTRAINT "streak_milestones_reward_pool_id_reward_pools_id_fk" FOREIGN KEY ("reward_pool_id") REFERENCES "public"."reward_pools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_ticket_id_support_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."support_tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_author_id_profiles_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_assigned_to_id_profiles_id_fk" FOREIGN KEY ("assigned_to_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tile_discoveries" ADD CONSTRAINT "tile_discoveries_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tile_discoveries" ADD CONSTRAINT "tile_discoveries_tile_id_map_tiles_id_fk" FOREIGN KEY ("tile_id") REFERENCES "public"."map_tiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tile_discoveries" ADD CONSTRAINT "tile_discoveries_area_id_map_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."map_areas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tile_discoveries" ADD CONSTRAINT "tile_discoveries_pool_entry_id_reward_pool_entries_id_fk" FOREIGN KEY ("pool_entry_id") REFERENCES "public"."reward_pool_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tile_discoveries" ADD CONSTRAINT "tile_discoveries_ledger_transaction_id_ledger_transactions_id_fk" FOREIGN KEY ("ledger_transaction_id") REFERENCES "public"."ledger_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uploaded_files" ADD CONSTRAINT "uploaded_files_owner_id_profiles_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_achievement_id_achievements_id_fk" FOREIGN KEY ("achievement_id") REFERENCES "public"."achievements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_notes" ADD CONSTRAINT "user_notes_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_notes" ADD CONSTRAINT "user_notes_author_id_profiles_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_streaks" ADD CONSTRAINT "user_streaks_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vault_unlocks" ADD CONSTRAINT "vault_unlocks_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vault_unlocks" ADD CONSTRAINT "vault_unlocks_vault_id_vaults_id_fk" FOREIGN KEY ("vault_id") REFERENCES "public"."vaults"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vaults" ADD CONSTRAINT "vaults_map_id_maps_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."maps"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vaults" ADD CONSTRAINT "vaults_reward_pool_id_reward_pools_id_fk" FOREIGN KEY ("reward_pool_id") REFERENCES "public"."reward_pools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "withdrawal_accounts" ADD CONSTRAINT "withdrawal_accounts_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "withdrawals" ADD CONSTRAINT "withdrawals_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "withdrawals" ADD CONSTRAINT "withdrawals_withdrawal_account_id_withdrawal_accounts_id_fk" FOREIGN KEY ("withdrawal_account_id") REFERENCES "public"."withdrawal_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "withdrawals" ADD CONSTRAINT "withdrawals_reviewer_id_profiles_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "withdrawals" ADD CONSTRAINT "withdrawals_request_transaction_id_ledger_transactions_id_fk" FOREIGN KEY ("request_transaction_id") REFERENCES "public"."ledger_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "withdrawals" ADD CONSTRAINT "withdrawals_settle_transaction_id_ledger_transactions_id_fk" FOREIGN KEY ("settle_transaction_id") REFERENCES "public"."ledger_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xp_levels" ADD CONSTRAINT "xp_levels_reward_pool_id_reward_pools_id_fk" FOREIGN KEY ("reward_pool_id") REFERENCES "public"."reward_pools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xp_transactions" ADD CONSTRAINT "xp_transactions_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "achievements_key_uq" ON "achievements" USING btree ("key");--> statement-breakpoint
CREATE UNIQUE INDEX "au_user_area_uq" ON "area_unlocks" USING btree ("user_id","area_id");--> statement-breakpoint
CREATE INDEX "audit_actor_idx" ON "audit_logs" USING btree ("actor_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_entity_idx" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_created_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "cr_user_idx" ON "cash_rewards" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "cr_status_idx" ON "cash_rewards" USING btree ("status","settle_after");--> statement-breakpoint
CREATE UNIQUE INDEX "cr_referral_uq" ON "cash_rewards" USING btree ("user_id","deposit_id","referral_level") WHERE "cash_rewards"."deposit_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "cc_user_collection_uq" ON "collection_completions" USING btree ("user_id","collection_id");--> statement-breakpoint
CREATE UNIQUE INDEX "collections_slug_uq" ON "collections" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "content_pages_slug_uq" ON "content_pages" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "conversions_user_idem_uq" ON "conversions" USING btree ("user_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "conversions_user_idx" ON "conversions" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "dec_user_day_uq" ON "daily_event_claims" USING btree ("user_id","day");--> statement-breakpoint
CREATE UNIQUE INDEX "dl_user_day_uq" ON "daily_logins" USING btree ("user_id","day");--> statement-breakpoint
CREATE UNIQUE INDEX "daily_schedules_day_uq" ON "daily_schedules" USING btree ("day");--> statement-breakpoint
CREATE UNIQUE INDEX "ds_user_day_uq" ON "daily_spins" USING btree ("user_id","day");--> statement-breakpoint
CREATE UNIQUE INDEX "deposit_levels_order_uq" ON "deposit_levels" USING btree ("sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "deposits_user_idem_uq" ON "deposits" USING btree ("user_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "deposits_status_idx" ON "deposits" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "deposits_user_idx" ON "deposits" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "deposits_reference_idx" ON "deposits" USING btree ("reference");--> statement-breakpoint
CREATE UNIQUE INDEX "fa_user_type_uq" ON "financial_accounts" USING btree ("user_id","type") WHERE "financial_accounts"."user_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "fa_system_type_currency_uq" ON "financial_accounts" USING btree ("type","currency") WHERE "financial_accounts"."user_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "help_articles_slug_uq" ON "help_articles" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "ie_user_idx" ON "inventory_events" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "ie_item_idx" ON "inventory_events" USING btree ("item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "items_slug_uq" ON "items" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "items_collection_idx" ON "items" USING btree ("collection_id");--> statement-breakpoint
CREATE INDEX "items_kind_idx" ON "items" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "job_runs_job_idx" ON "job_runs" USING btree ("job","started_at");--> statement-breakpoint
CREATE INDEX "le_tx_idx" ON "ledger_entries" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "le_account_idx" ON "ledger_entries" USING btree ("account_id","id");--> statement-breakpoint
CREATE INDEX "le_user_idx" ON "ledger_entries" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ltx_idem_uq" ON "ledger_transactions" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "ltx_user_idx" ON "ledger_transactions" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "ltx_source_idx" ON "ledger_transactions" USING btree ("source_type","source_id");--> statement-breakpoint
CREATE INDEX "ltx_type_idx" ON "ledger_transactions" USING btree ("type","created_at");--> statement-breakpoint
CREATE INDEX "login_events_user_idx" ON "login_events" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "login_events_ip_idx" ON "login_events" USING btree ("ip");--> statement-breakpoint
CREATE INDEX "login_events_device_idx" ON "login_events" USING btree ("device_id");--> statement-breakpoint
CREATE UNIQUE INDEX "map_areas_slug_uq" ON "map_areas" USING btree ("map_id","slug");--> statement-breakpoint
CREATE INDEX "map_areas_map_idx" ON "map_areas" USING btree ("map_id");--> statement-breakpoint
CREATE UNIQUE INDEX "map_tiles_pos_uq" ON "map_tiles" USING btree ("area_id","row","col");--> statement-breakpoint
CREATE INDEX "map_tiles_area_idx" ON "map_tiles" USING btree ("area_id");--> statement-breakpoint
CREATE UNIQUE INDEX "maps_slug_uq" ON "maps" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "mbc_user_day_uq" ON "mission_bonus_claims" USING btree ("user_id","day");--> statement-breakpoint
CREATE UNIQUE INDEX "mission_defs_key_uq" ON "mission_definitions" USING btree ("key");--> statement-breakpoint
CREATE UNIQUE INDEX "mbp_user_idem_uq" ON "mystery_box_plays" USING btree ("user_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "mbp_user_idx" ON "mystery_box_plays" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "mbp_box_idx" ON "mystery_box_plays" USING btree ("box_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "mystery_boxes_slug_uq" ON "mystery_boxes" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "profiles_email_uq" ON "profiles" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "profiles_referral_code_uq" ON "profiles" USING btree ("referral_code");--> statement-breakpoint
CREATE INDEX "profiles_referred_by_idx" ON "profiles" USING btree ("referred_by_id");--> statement-breakpoint
CREATE INDEX "profiles_role_idx" ON "profiles" USING btree ("role");--> statement-breakpoint
CREATE INDEX "profiles_created_idx" ON "profiles" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "requirements_owner_idx" ON "requirements" USING btree ("owner_type","owner_id");--> statement-breakpoint
CREATE INDEX "rpe_pool_idx" ON "reward_pool_entries" USING btree ("pool_id");--> statement-breakpoint
CREATE INDEX "risk_flags_user_idx" ON "risk_flags" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "risk_flags_status_idx" ON "risk_flags" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "smc_user_ms_run_uq" ON "streak_milestone_claims" USING btree ("user_id","milestone_id","run_start_day");--> statement-breakpoint
CREATE UNIQUE INDEX "streak_milestones_days_uq" ON "streak_milestones" USING btree ("days");--> statement-breakpoint
CREATE INDEX "support_messages_ticket_idx" ON "support_messages" USING btree ("ticket_id","created_at");--> statement-breakpoint
CREATE INDEX "tickets_status_idx" ON "support_tickets" USING btree ("status","last_message_at");--> statement-breakpoint
CREATE INDEX "tickets_user_idx" ON "support_tickets" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "td_user_tile_uq" ON "tile_discoveries" USING btree ("user_id","tile_id");--> statement-breakpoint
CREATE INDEX "td_user_idx" ON "tile_discoveries" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "td_user_day_idx" ON "tile_discoveries" USING btree ("user_id","app_day");--> statement-breakpoint
CREATE UNIQUE INDEX "ua_user_ach_uq" ON "user_achievements" USING btree ("user_id","achievement_id");--> statement-breakpoint
CREATE INDEX "user_notes_user_idx" ON "user_notes" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "vu_user_vault_uq" ON "vault_unlocks" USING btree ("user_id","vault_id");--> statement-breakpoint
CREATE UNIQUE INDEX "vaults_slug_uq" ON "vaults" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "wa_user_idx" ON "withdrawal_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "wa_number_idx" ON "withdrawal_accounts" USING btree ("account_number");--> statement-breakpoint
CREATE UNIQUE INDEX "withdrawals_user_idem_uq" ON "withdrawals" USING btree ("user_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "withdrawals_status_idx" ON "withdrawals" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "withdrawals_user_idx" ON "withdrawals" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "xp_levels_required_uq" ON "xp_levels" USING btree ("xp_required");--> statement-breakpoint
CREATE UNIQUE INDEX "xpt_idem_uq" ON "xp_transactions" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "xpt_user_idx" ON "xp_transactions" USING btree ("user_id","created_at");