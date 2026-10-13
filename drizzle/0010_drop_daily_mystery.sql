ALTER TABLE "daily_event_claims" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "daily_event_claims" CASCADE;--> statement-breakpoint
ALTER TABLE "daily_schedules" DROP CONSTRAINT "daily_schedules_event_pool_id_reward_pools_id_fk";
--> statement-breakpoint
UPDATE "daily_schedules" SET "mission1_id" = NULL WHERE "mission1_id" IN (SELECT "id" FROM "mission_definitions" WHERE "action" = 'DAILY_EVENT');--> statement-breakpoint
UPDATE "daily_schedules" SET "mission2_id" = NULL WHERE "mission2_id" IN (SELECT "id" FROM "mission_definitions" WHERE "action" = 'DAILY_EVENT');--> statement-breakpoint
UPDATE "daily_schedules" SET "mission3_id" = NULL WHERE "mission3_id" IN (SELECT "id" FROM "mission_definitions" WHERE "action" = 'DAILY_EVENT');--> statement-breakpoint
DELETE FROM "mission_progress" WHERE "mission_id" IN (SELECT "id" FROM "mission_definitions" WHERE "action" = 'DAILY_EVENT');--> statement-breakpoint
DELETE FROM "mission_definitions" WHERE "action" = 'DAILY_EVENT';--> statement-breakpoint
ALTER TABLE "mission_definitions" ALTER COLUMN "action" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."mission_action";--> statement-breakpoint
CREATE TYPE "public"."mission_action" AS ENUM('DAILY_LOGIN', 'DAILY_SPIN', 'OPEN_BOX', 'DISCOVER_TILE', 'CONVERT_CREDITS', 'UNLOCK_AREA', 'COLLECT_ITEM');--> statement-breakpoint
ALTER TABLE "mission_definitions" ALTER COLUMN "action" SET DATA TYPE "public"."mission_action" USING "action"::"public"."mission_action";--> statement-breakpoint
ALTER TABLE "daily_schedules" DROP COLUMN "event_title";--> statement-breakpoint
ALTER TABLE "daily_schedules" DROP COLUMN "event_description";--> statement-breakpoint
ALTER TABLE "daily_schedules" DROP COLUMN "event_icon";--> statement-breakpoint
ALTER TABLE "daily_schedules" DROP COLUMN "event_pool_id";--> statement-breakpoint
ALTER TABLE "daily_schedules" DROP COLUMN "event_cost_credits";