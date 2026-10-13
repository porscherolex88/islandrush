CREATE TABLE "free_box_plays" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"box_id" uuid NOT NULL,
	"source_play_id" uuid NOT NULL,
	"used_by_play_id" uuid,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "free_box_plays" ADD CONSTRAINT "free_box_plays_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "free_box_plays" ADD CONSTRAINT "free_box_plays_box_id_mystery_boxes_id_fk" FOREIGN KEY ("box_id") REFERENCES "public"."mystery_boxes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "fbp_source_uq" ON "free_box_plays" USING btree ("source_play_id");--> statement-breakpoint
CREATE UNIQUE INDEX "fbp_used_by_uq" ON "free_box_plays" USING btree ("used_by_play_id");--> statement-breakpoint
CREATE INDEX "fbp_user_box_idx" ON "free_box_plays" USING btree ("user_id","box_id");