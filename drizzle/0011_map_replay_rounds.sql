DROP INDEX "bbo_user_map_uq";--> statement-breakpoint
DROP INDEX "uc_user_cp_uq";--> statement-breakpoint
ALTER TABLE "big_box_openings" ADD COLUMN "round" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "user_checkpoints" ADD COLUMN "round" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "user_map_progress" ADD COLUMN "round" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "user_map_progress" ADD COLUMN "round_loot_base" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "user_map_progress" ADD COLUMN "round_completed_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "bbo_user_map_round_uq" ON "big_box_openings" USING btree ("user_id","map_id","round");--> statement-breakpoint
CREATE UNIQUE INDEX "uc_user_cp_round_uq" ON "user_checkpoints" USING btree ("user_id","checkpoint_id","round");--> statement-breakpoint
UPDATE "user_map_progress" SET "round_completed_at" = "completed_at" WHERE "completed_at" IS NOT NULL;
