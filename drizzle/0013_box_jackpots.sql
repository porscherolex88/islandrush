CREATE TABLE "box_jackpots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"box_id" uuid NOT NULL,
	"trigger_play_id" uuid NOT NULL,
	"plays_at" integer NOT NULL,
	"spins" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mystery_box_plays" ADD COLUMN "jackpot_id" uuid;--> statement-breakpoint
ALTER TABLE "mystery_box_plays" ADD COLUMN "jackpot_spin" integer;--> statement-breakpoint
ALTER TABLE "mystery_boxes" ADD COLUMN "jackpot_plays" integer DEFAULT 50 NOT NULL;--> statement-breakpoint
ALTER TABLE "mystery_boxes" ADD COLUMN "jackpot_spins" integer DEFAULT 10 NOT NULL;--> statement-breakpoint
ALTER TABLE "box_jackpots" ADD CONSTRAINT "box_jackpots_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "box_jackpots" ADD CONSTRAINT "box_jackpots_box_id_mystery_boxes_id_fk" FOREIGN KEY ("box_id") REFERENCES "public"."mystery_boxes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bj_trigger_uq" ON "box_jackpots" USING btree ("trigger_play_id");--> statement-breakpoint
CREATE INDEX "bj_user_box_idx" ON "box_jackpots" USING btree ("user_id","box_id");--> statement-breakpoint
CREATE INDEX "mbp_jackpot_idx" ON "mystery_box_plays" USING btree ("jackpot_id");