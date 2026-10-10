UPDATE "reward_pools" SET "status" = 'ARCHIVED', "updated_at" = now() WHERE "id" IN (SELECT "reward_pool_id" FROM "xp_levels" WHERE "reward_pool_id" IS NOT NULL);--> statement-breakpoint
DELETE FROM "reward_pool_entries" WHERE "reward_type" = 'XP';--> statement-breakpoint
DELETE FROM "user_achievements" WHERE "achievement_id" IN (SELECT "id" FROM "achievements" WHERE "condition" = 'XP_LEVEL');--> statement-breakpoint
DELETE FROM "achievements" WHERE "condition" = 'XP_LEVEL';--> statement-breakpoint
DELETE FROM "requirements" WHERE "type" = 'XP_LEVEL';--> statement-breakpoint
DROP TABLE "xp_levels" CASCADE;--> statement-breakpoint
DROP TABLE "xp_rules" CASCADE;--> statement-breakpoint
DROP TABLE "xp_transactions" CASCADE;--> statement-breakpoint
ALTER TABLE "achievements" ALTER COLUMN "condition" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."achievement_condition";--> statement-breakpoint
CREATE TYPE "public"."achievement_condition" AS ENUM('BOXES_OPENED', 'TILES_DISCOVERED', 'AREAS_UNLOCKED', 'COLLECTIONS_COMPLETED', 'VAULTS_UNLOCKED', 'STREAK_DAYS', 'ITEMS_COLLECTED');--> statement-breakpoint
ALTER TABLE "achievements" ALTER COLUMN "condition" SET DATA TYPE "public"."achievement_condition" USING "condition"::"public"."achievement_condition";--> statement-breakpoint
ALTER TABLE "requirements" ALTER COLUMN "type" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."requirement_type";--> statement-breakpoint
CREATE TYPE "public"."requirement_type" AS ENUM('ITEM', 'COLLECTION_COMPLETE', 'COLLECTION_PROGRESS', 'AREA_UNLOCKED', 'AREA_TILES');--> statement-breakpoint
ALTER TABLE "requirements" ALTER COLUMN "type" SET DATA TYPE "public"."requirement_type" USING "type"::"public"."requirement_type";--> statement-breakpoint
ALTER TABLE "reward_pool_entries" ALTER COLUMN "reward_type" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."reward_type";--> statement-breakpoint
CREATE TYPE "public"."reward_type" AS ENUM('CREDITS', 'CASH', 'ITEM', 'AREA_UNLOCK');--> statement-breakpoint
ALTER TABLE "reward_pool_entries" ALTER COLUMN "reward_type" SET DATA TYPE "public"."reward_type" USING "reward_type"::"public"."reward_type";--> statement-breakpoint
ALTER TABLE "daily_logins" DROP COLUMN "xp_awarded";--> statement-breakpoint
ALTER TABLE "mystery_box_plays" DROP COLUMN "xp_awarded";--> statement-breakpoint
ALTER TABLE "mystery_boxes" DROP COLUMN "xp_reward";--> statement-breakpoint
ALTER TABLE "profiles" DROP COLUMN "xp_total";--> statement-breakpoint
ALTER TABLE "profiles" DROP COLUMN "xp_level";