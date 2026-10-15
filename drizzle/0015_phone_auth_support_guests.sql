ALTER TABLE "profiles" ADD COLUMN "date_of_birth" date;--> statement-breakpoint
ALTER TABLE "support_tickets" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD COLUMN "contact_phone" text;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD COLUMN "contact_name" text;--> statement-breakpoint
ALTER TABLE "support_messages" ALTER COLUMN "author_id" DROP NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "profiles_phone_uq" ON "profiles" USING btree ("phone") WHERE "phone" IS NOT NULL;
