CREATE TYPE "public"."progression_item_type" AS ENUM('unlock', 'item', 'gear', 'goal', 'custom');--> statement-breakpoint
CREATE TYPE "public"."profit_potential" AS ENUM('high', 'medium', 'low');--> statement-breakpoint
CREATE TYPE "public"."trade_source" AS ENUM('manual', 'auto-import');--> statement-breakpoint
CREATE TYPE "public"."trade_type" AS ENUM('buy', 'sell');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "character_progression_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"character_id" uuid NOT NULL,
	"category_id" uuid,
	"item_type" "progression_item_type" NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"item_id" integer,
	"unlock_flag" text,
	"completed" boolean DEFAULT false NOT NULL,
	"completed_at" timestamp with time zone,
	"notes" text,
	"order_index" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "progression_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"icon" text,
	"order_index" integer DEFAULT 0 NOT NULL,
	"default_items" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ge_flip_suggestions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" integer NOT NULL,
	"item_name" text NOT NULL,
	"current_margin" integer NOT NULL,
	"margin_percent" numeric(10, 2) NOT NULL,
	"buy_price" integer NOT NULL,
	"sell_price" integer NOT NULL,
	"daily_volume" integer,
	"profit_potential" "profit_potential" NOT NULL,
	"calculated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"data_source" text DEFAULT 'wiki_api' NOT NULL,
	CONSTRAINT "ge_flip_suggestions_item_id_unique" UNIQUE("item_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ge_trades" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"character_id" uuid NOT NULL,
	"item_id" integer NOT NULL,
	"item_name" text NOT NULL,
	"trade_type" "trade_type" NOT NULL,
	"quantity" integer NOT NULL,
	"price_per_item" integer NOT NULL,
	"total_value" bigint NOT NULL,
	"traded_at" timestamp with time zone NOT NULL,
	"matched_trade_id" uuid,
	"profit_per_item" integer,
	"total_profit" bigint,
	"notes" text,
	"source" "trade_source" DEFAULT 'manual' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ge_watch_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"character_id" uuid NOT NULL,
	"item_id" integer NOT NULL,
	"item_name" text NOT NULL,
	"alert_on_margin" integer,
	"alert_on_buy_price" integer,
	"alert_on_sell_price" integer,
	"alert_on_volume" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_alerted_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "character_progression_items" ADD CONSTRAINT "character_progression_items_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "character_progression_items" ADD CONSTRAINT "character_progression_items_category_id_progression_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."progression_categories"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ge_trades" ADD CONSTRAINT "ge_trades_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ge_trades" ADD CONSTRAINT "ge_trades_matched_trade_id_ge_trades_id_fk" FOREIGN KEY ("matched_trade_id") REFERENCES "public"."ge_trades"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ge_watch_items" ADD CONSTRAINT "ge_watch_items_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "progression_items_character_id_idx" ON "character_progression_items" USING btree ("character_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "progression_items_character_completed_idx" ON "character_progression_items" USING btree ("character_id","completed");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "progression_items_category_id_idx" ON "character_progression_items" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ge_flip_margin_percent_idx" ON "ge_flip_suggestions" USING btree ("margin_percent");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ge_flip_calculated_at_idx" ON "ge_flip_suggestions" USING btree ("calculated_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ge_flip_profit_potential_idx" ON "ge_flip_suggestions" USING btree ("profit_potential");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ge_trades_character_id_idx" ON "ge_trades" USING btree ("character_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ge_trades_item_id_idx" ON "ge_trades" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ge_trades_traded_at_idx" ON "ge_trades" USING btree ("traded_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ge_trades_character_item_idx" ON "ge_trades" USING btree ("character_id","item_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ge_watch_items_character_id_idx" ON "ge_watch_items" USING btree ("character_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ge_watch_items_character_active_idx" ON "ge_watch_items" USING btree ("character_id","is_active");