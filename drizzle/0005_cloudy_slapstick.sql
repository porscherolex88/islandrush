CREATE TYPE "public"."market_listing_status" AS ENUM('ACTIVE', 'SOLD', 'CANCELLED');--> statement-breakpoint
ALTER TYPE "public"."ledger_tx_type" ADD VALUE 'MARKET_TRADE';--> statement-breakpoint
CREATE TABLE "market_listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seller_id" text NOT NULL,
	"item_id" uuid NOT NULL,
	"listed_quantity" integer NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price" bigint NOT NULL,
	"status" "market_listing_status" DEFAULT 'ACTIVE' NOT NULL,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ml_qty_valid" CHECK ("market_listings"."quantity" >= 0 AND "market_listings"."quantity" <= "market_listings"."listed_quantity"),
	CONSTRAINT "ml_price_positive" CHECK ("market_listings"."unit_price" > 0)
);
--> statement-breakpoint
CREATE TABLE "market_sales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"buyer_id" text NOT NULL,
	"seller_id" text NOT NULL,
	"item_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price" bigint NOT NULL,
	"total" bigint NOT NULL,
	"fee" bigint NOT NULL,
	"ledger_transaction_id" uuid,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "market_listings" ADD CONSTRAINT "market_listings_seller_id_profiles_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_listings" ADD CONSTRAINT "market_listings_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_sales" ADD CONSTRAINT "market_sales_listing_id_market_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."market_listings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_sales" ADD CONSTRAINT "market_sales_buyer_id_profiles_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_sales" ADD CONSTRAINT "market_sales_seller_id_profiles_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_sales" ADD CONSTRAINT "market_sales_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_sales" ADD CONSTRAINT "market_sales_ledger_transaction_id_ledger_transactions_id_fk" FOREIGN KEY ("ledger_transaction_id") REFERENCES "public"."ledger_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ml_status_idx" ON "market_listings" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "ml_seller_idx" ON "market_listings" USING btree ("seller_id","status");--> statement-breakpoint
CREATE INDEX "ml_item_idx" ON "market_listings" USING btree ("item_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "ms_buyer_idem_uq" ON "market_sales" USING btree ("buyer_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "ms_listing_idx" ON "market_sales" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "ms_seller_idx" ON "market_sales" USING btree ("seller_id","created_at");