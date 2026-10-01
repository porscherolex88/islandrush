CREATE TYPE "public"."game_event_type" AS ENUM('MYSTERY_BOX_PURCHASE', 'MYSTERY_BOX_REWARD', 'LOOT_REWARD', 'MAP_UNLOCK', 'MAP_CHECKPOINT_UNLOCK', 'MAP_COMPLETION', 'BIG_MYSTERY_BOX_OPEN', 'PUZZLE_PIECE_REWARD', 'PUZZLE_COMPLETED', 'PRIZE_UNLOCK_ATTEMPT', 'PRIZE_UNLOCK_RESULT', 'ALTERNATIVE_REWARD', 'PRIZE_CLAIM', 'PRIZE_CLAIM_STATUS');--> statement-breakpoint
CREATE TYPE "public"."prize_claim_status" AS ENUM('UNLOCKED', 'CLAIM_PENDING', 'UNDER_REVIEW', 'APPROVED', 'FULFILLING', 'FULFILLED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."prize_kind" AS ENUM('PHYSICAL', 'CREDITS', 'CASH');--> statement-breakpoint
CREATE TYPE "public"."unlock_outcome" AS ENUM('PRIZE', 'ALTERNATIVE');--> statement-breakpoint
ALTER TYPE "public"."item_kind" ADD VALUE 'LOOT';--> statement-breakpoint
CREATE TABLE "big_box_openings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"map_id" uuid NOT NULL,
	"big_box_id" uuid NOT NULL,
	"level" integer NOT NULL,
	"pieces" integer NOT NULL,
	"odds" jsonb NOT NULL,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bbo_pieces_range" CHECK ("big_box_openings"."pieces" between 1 and 3)
);
--> statement-breakpoint
CREATE TABLE "big_mystery_boxes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"map_id" uuid NOT NULL,
	"name" text DEFAULT 'Big Mystery Box' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"artwork" text,
	"pieces_1_pct" integer DEFAULT 50 NOT NULL,
	"pieces_2_pct" integer DEFAULT 35 NOT NULL,
	"pieces_3_pct" integer DEFAULT 15 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bmb_pct_nonneg" CHECK ("big_mystery_boxes"."pieces_1_pct" >= 0 and "big_mystery_boxes"."pieces_2_pct" >= 0 and "big_mystery_boxes"."pieces_3_pct" >= 0),
	CONSTRAINT "bmb_pct_total" CHECK ("big_mystery_boxes"."pieces_1_pct" + "big_mystery_boxes"."pieces_2_pct" + "big_mystery_boxes"."pieces_3_pct" = 100)
);
--> statement-breakpoint
CREATE TABLE "game_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" "game_event_type" NOT NULL,
	"action_id" text NOT NULL,
	"level" integer,
	"ref_type" text,
	"ref_id" text,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"result" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ledger_transaction_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "map_checkpoints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"map_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"landmark" text DEFAULT 'flag' NOT NULL,
	"loot_required" integer NOT NULL,
	"is_final" boolean DEFAULT false NOT NULL,
	"pos_x" integer DEFAULT 50 NOT NULL,
	"pos_y" integer DEFAULT 50 NOT NULL,
	"status" "content_status" DEFAULT 'PUBLISHED' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mcp_loot_nonneg" CHECK ("map_checkpoints"."loot_required" >= 0),
	CONSTRAINT "mcp_pos_range" CHECK ("map_checkpoints"."pos_x" between 0 and 100 and "map_checkpoints"."pos_y" between 0 and 100)
);
--> statement-breakpoint
CREATE TABLE "prize_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"prize_id" uuid NOT NULL,
	"attempt_id" uuid NOT NULL,
	"level" integer NOT NULL,
	"status" "prize_claim_status" DEFAULT 'UNLOCKED' NOT NULL,
	"prize_snapshot" jsonb NOT NULL,
	"contact" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"reviewer_id" text,
	"review_note" text,
	"ledger_transaction_id" uuid,
	"claimed_at" timestamp with time zone,
	"fulfilled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prize_unlock_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"puzzle_id" uuid NOT NULL,
	"user_puzzle_id" uuid NOT NULL,
	"prize_id" uuid NOT NULL,
	"level" integer NOT NULL,
	"idempotency_key" text NOT NULL,
	"outcome" "unlock_outcome" NOT NULL,
	"roll" integer NOT NULL,
	"odds" jsonb NOT NULL,
	"alternative_reward" jsonb,
	"ledger_transaction_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prizes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"level" integer NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"image" text,
	"kind" "prize_kind" DEFAULT 'PHYSICAL' NOT NULL,
	"amount" numeric(20, 2) DEFAULT '0' NOT NULL,
	"estimated_value" numeric(20, 2),
	"show_estimated_value" boolean DEFAULT false NOT NULL,
	"inventory_total" integer,
	"inventory_allocated" integer DEFAULT 0 NOT NULL,
	"requires_verification" boolean DEFAULT false NOT NULL,
	"claim_instructions" text DEFAULT '' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "prizes_inventory" CHECK ("prizes"."inventory_total" is null or "prizes"."inventory_allocated" <= "prizes"."inventory_total"),
	CONSTRAINT "prizes_allocated_nonneg" CHECK ("prizes"."inventory_allocated" >= 0)
);
--> statement-breakpoint
CREATE TABLE "puzzle_piece_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"delta" integer NOT NULL,
	"source_type" text NOT NULL,
	"source_id" text NOT NULL,
	"level" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "puzzles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"level" integer NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"image" text,
	"pieces_required" integer NOT NULL,
	"prize_id" uuid NOT NULL,
	"alternative_reward_type" text DEFAULT 'CREDITS' NOT NULL,
	"alternative_reward_amount" numeric(20, 2) DEFAULT '0' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "puzzles_pieces_pos" CHECK ("puzzles"."pieces_required" > 0),
	CONSTRAINT "puzzles_alt_type" CHECK ("puzzles"."alternative_reward_type" in ('CREDITS', 'CASH'))
);
--> statement-breakpoint
CREATE TABLE "user_checkpoints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"checkpoint_id" uuid NOT NULL,
	"map_id" uuid NOT NULL,
	"loot_required" integer NOT NULL,
	"loot_at_unlock" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_map_progress" (
	"user_id" text NOT NULL,
	"map_id" uuid NOT NULL,
	"level" integer NOT NULL,
	"loot_at_unlock" integer NOT NULL,
	"unlocked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "user_map_progress_user_id_map_id_pk" PRIMARY KEY("user_id","map_id")
);
--> statement-breakpoint
CREATE TABLE "user_puzzles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"puzzle_id" uuid NOT NULL,
	"level" integer NOT NULL,
	"pieces_required" integer NOT NULL,
	"pieces_total_at" integer NOT NULL,
	"prize_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "adventure_level" integer;--> statement-breakpoint
ALTER TABLE "maps" ADD COLUMN "level" integer;--> statement-breakpoint
ALTER TABLE "maps" ADD COLUMN "loot_required" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "maps" ADD COLUMN "artwork" text;--> statement-breakpoint
ALTER TABLE "maps" ADD COLUMN "color" text DEFAULT '#0ea5e9' NOT NULL;--> statement-breakpoint
ALTER TABLE "mystery_box_plays" ADD COLUMN "level" integer;--> statement-breakpoint
ALTER TABLE "mystery_box_plays" ADD COLUMN "loot" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "mystery_box_plays" ADD COLUMN "config_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "mystery_boxes" ADD COLUMN "level" integer;--> statement-breakpoint
ALTER TABLE "mystery_boxes" ADD COLUMN "requires_map_level" integer;--> statement-breakpoint
ALTER TABLE "mystery_boxes" ADD COLUMN "loot_pool_id" uuid;--> statement-breakpoint
ALTER TABLE "mystery_boxes" ADD COLUMN "artwork" text;--> statement-breakpoint
ALTER TABLE "big_box_openings" ADD CONSTRAINT "big_box_openings_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "big_box_openings" ADD CONSTRAINT "big_box_openings_map_id_maps_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."maps"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "big_box_openings" ADD CONSTRAINT "big_box_openings_big_box_id_big_mystery_boxes_id_fk" FOREIGN KEY ("big_box_id") REFERENCES "public"."big_mystery_boxes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "big_mystery_boxes" ADD CONSTRAINT "big_mystery_boxes_map_id_maps_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."maps"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_events" ADD CONSTRAINT "game_events_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "map_checkpoints" ADD CONSTRAINT "map_checkpoints_map_id_maps_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."maps"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prize_claims" ADD CONSTRAINT "prize_claims_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prize_claims" ADD CONSTRAINT "prize_claims_prize_id_prizes_id_fk" FOREIGN KEY ("prize_id") REFERENCES "public"."prizes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prize_claims" ADD CONSTRAINT "prize_claims_attempt_id_prize_unlock_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."prize_unlock_attempts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prize_claims" ADD CONSTRAINT "prize_claims_reviewer_id_profiles_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prize_claims" ADD CONSTRAINT "prize_claims_ledger_transaction_id_ledger_transactions_id_fk" FOREIGN KEY ("ledger_transaction_id") REFERENCES "public"."ledger_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prize_unlock_attempts" ADD CONSTRAINT "prize_unlock_attempts_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prize_unlock_attempts" ADD CONSTRAINT "prize_unlock_attempts_puzzle_id_puzzles_id_fk" FOREIGN KEY ("puzzle_id") REFERENCES "public"."puzzles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prize_unlock_attempts" ADD CONSTRAINT "prize_unlock_attempts_user_puzzle_id_user_puzzles_id_fk" FOREIGN KEY ("user_puzzle_id") REFERENCES "public"."user_puzzles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prize_unlock_attempts" ADD CONSTRAINT "prize_unlock_attempts_prize_id_prizes_id_fk" FOREIGN KEY ("prize_id") REFERENCES "public"."prizes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prize_unlock_attempts" ADD CONSTRAINT "prize_unlock_attempts_ledger_transaction_id_ledger_transactions_id_fk" FOREIGN KEY ("ledger_transaction_id") REFERENCES "public"."ledger_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "puzzle_piece_events" ADD CONSTRAINT "puzzle_piece_events_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "puzzles" ADD CONSTRAINT "puzzles_prize_id_prizes_id_fk" FOREIGN KEY ("prize_id") REFERENCES "public"."prizes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_checkpoints" ADD CONSTRAINT "user_checkpoints_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_checkpoints" ADD CONSTRAINT "user_checkpoints_checkpoint_id_map_checkpoints_id_fk" FOREIGN KEY ("checkpoint_id") REFERENCES "public"."map_checkpoints"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_checkpoints" ADD CONSTRAINT "user_checkpoints_map_id_maps_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."maps"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_map_progress" ADD CONSTRAINT "user_map_progress_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_map_progress" ADD CONSTRAINT "user_map_progress_map_id_maps_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."maps"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_puzzles" ADD CONSTRAINT "user_puzzles_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_puzzles" ADD CONSTRAINT "user_puzzles_puzzle_id_puzzles_id_fk" FOREIGN KEY ("puzzle_id") REFERENCES "public"."puzzles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_puzzles" ADD CONSTRAINT "user_puzzles_prize_id_prizes_id_fk" FOREIGN KEY ("prize_id") REFERENCES "public"."prizes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bbo_user_map_uq" ON "big_box_openings" USING btree ("user_id","map_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bmb_map_uq" ON "big_mystery_boxes" USING btree ("map_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ge_type_action_uq" ON "game_events" USING btree ("type","action_id");--> statement-breakpoint
CREATE INDEX "ge_user_idx" ON "game_events" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "ge_type_idx" ON "game_events" USING btree ("type","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "mcp_map_pos_uq" ON "map_checkpoints" USING btree ("map_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "mcp_map_final_uq" ON "map_checkpoints" USING btree ("map_id") WHERE "map_checkpoints"."is_final";--> statement-breakpoint
CREATE UNIQUE INDEX "pc_attempt_uq" ON "prize_claims" USING btree ("attempt_id");--> statement-breakpoint
CREATE INDEX "pc_status_idx" ON "prize_claims" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "pc_user_idx" ON "prize_claims" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "pua_user_puzzle_uq" ON "prize_unlock_attempts" USING btree ("user_id","puzzle_id");--> statement-breakpoint
CREATE INDEX "pua_user_idx" ON "prize_unlock_attempts" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "prizes_level_idx" ON "prizes" USING btree ("level");--> statement-breakpoint
CREATE UNIQUE INDEX "ppe_source_uq" ON "puzzle_piece_events" USING btree ("source_type","source_id");--> statement-breakpoint
CREATE INDEX "ppe_user_idx" ON "puzzle_piece_events" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "puzzles_level_uq" ON "puzzles" USING btree ("level");--> statement-breakpoint
CREATE UNIQUE INDEX "uc_user_cp_uq" ON "user_checkpoints" USING btree ("user_id","checkpoint_id");--> statement-breakpoint
CREATE INDEX "uc_user_map_idx" ON "user_checkpoints" USING btree ("user_id","map_id");--> statement-breakpoint
CREATE INDEX "ump_user_idx" ON "user_map_progress" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "up_user_puzzle_uq" ON "user_puzzles" USING btree ("user_id","puzzle_id");--> statement-breakpoint
ALTER TABLE "mystery_boxes" ADD CONSTRAINT "mystery_boxes_loot_pool_id_reward_pools_id_fk" FOREIGN KEY ("loot_pool_id") REFERENCES "public"."reward_pools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "items_adventure_level_idx" ON "items" USING btree ("adventure_level");--> statement-breakpoint
CREATE UNIQUE INDEX "maps_level_uq" ON "maps" USING btree ("level") WHERE "maps"."level" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "mystery_boxes_level_uq" ON "mystery_boxes" USING btree ("level") WHERE "mystery_boxes"."level" is not null;--> statement-breakpoint
ALTER TABLE "maps" ADD CONSTRAINT "maps_level_range" CHECK ("maps"."level" is null or "maps"."level" between 1 and 10);--> statement-breakpoint
ALTER TABLE "maps" ADD CONSTRAINT "maps_loot_nonneg" CHECK ("maps"."loot_required" >= 0);--> statement-breakpoint
ALTER TABLE "mystery_boxes" ADD CONSTRAINT "mb_level_range" CHECK ("mystery_boxes"."level" is null or "mystery_boxes"."level" between 1 and 10);