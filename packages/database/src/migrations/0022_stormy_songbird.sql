-- Alerts & Game Events: new tables for price alerts and market event tracking

-- Enum: alert types for price threshold notifications
DO $$ BEGIN
  CREATE TYPE "public"."alert_type" AS ENUM('price-below', 'price-above', 'margin-threshold', 'volume-spike', 'quality-change', 'investment-opportunity');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

-- Enum: game event types for market event annotations
DO $$ BEGIN
  CREATE TYPE "public"."game_event_type" AS ENUM('game-update', 'boss-release', 'boss-nerf', 'boss-buff', 'item-nerf', 'item-buff', 'leagues', 'deadman-mode', 'holiday-event', 'pvp-update', 'economy-change', 'other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

-- Price Alerts table
CREATE TABLE IF NOT EXISTS "ge_alerts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_character_id" uuid NOT NULL,
  "item_id" integer NOT NULL,
  "item_name" text NOT NULL,
  "alert_type" "alert_type" NOT NULL,
  "title" text NOT NULL,
  "message" text NOT NULL,
  "trigger_value" integer,
  "threshold_value" integer,
  "is_read" boolean DEFAULT false NOT NULL,
  "is_delivered" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- Game Events table
CREATE TABLE IF NOT EXISTS "ge_game_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "event_type" "game_event_type" NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "event_date" timestamp with time zone NOT NULL,
  "end_date" timestamp with time zone,
  "affected_item_ids" text,
  "source_url" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- Market history tables (idempotent — may already exist from manual 0021)
CREATE TABLE IF NOT EXISTS "ge_daily_summary" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "item_id" integer NOT NULL,
  "date" timestamp with time zone NOT NULL,
  "avg_buy_price" integer,
  "avg_sell_price" integer,
  "high_buy_price" integer,
  "low_buy_price" integer,
  "high_sell_price" integer,
  "low_sell_price" integer,
  "total_volume" bigint,
  "avg_margin" integer,
  "avg_margin_percent" real,
  "snapshot_count" integer DEFAULT 0 NOT NULL,
  CONSTRAINT "ge_daily_summary_item_date_unique" UNIQUE("item_id","date")
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "ge_price_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "item_id" integer NOT NULL,
  "captured_at" timestamp with time zone DEFAULT now() NOT NULL,
  "buy_price" integer,
  "sell_price" integer,
  "margin" integer,
  "avg_high_price_5m" integer,
  "avg_low_price_5m" integer,
  "volume_5m" integer,
  "high_price_volume_5m" integer,
  "low_price_volume_5m" integer,
  "avg_high_price_1h" integer,
  "avg_low_price_1h" integer,
  "volume_1h" integer,
  "high_price_volume_1h" integer,
  "low_price_volume_1h" integer,
  "buy_limit" integer,
  CONSTRAINT "ge_price_history_item_captured_unique" UNIQUE("item_id","captured_at")
);
--> statement-breakpoint

-- Flip suggestion quality columns (idempotent)
ALTER TABLE "ge_flip_suggestions" ADD COLUMN IF NOT EXISTS "quality_volume_anomaly" integer;
--> statement-breakpoint
ALTER TABLE "ge_flip_suggestions" ADD COLUMN IF NOT EXISTS "quality_price_consistency" integer;
--> statement-breakpoint
ALTER TABLE "ge_flip_suggestions" ADD COLUMN IF NOT EXISTS "quality_historical_reliability" integer;
--> statement-breakpoint

-- Foreign keys
DO $$ BEGIN
  ALTER TABLE "ge_alerts" ADD CONSTRAINT "ge_alerts_user_character_id_user_characters_id_fk" FOREIGN KEY ("user_character_id") REFERENCES "public"."user_characters"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

-- Indexes (idempotent)
CREATE INDEX IF NOT EXISTS "ge_alerts_character_idx" ON "ge_alerts" USING btree ("user_character_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ge_alerts_unread_idx" ON "ge_alerts" USING btree ("user_character_id","is_read");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ge_game_events_date_idx" ON "ge_game_events" USING btree ("event_date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ge_game_events_type_idx" ON "ge_game_events" USING btree ("event_type");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ge_daily_summary_item_date_idx" ON "ge_daily_summary" USING btree ("item_id","date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ge_daily_summary_date_idx" ON "ge_daily_summary" USING btree ("date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ge_price_history_item_captured_at_idx" ON "ge_price_history" USING btree ("item_id","captured_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ge_price_history_captured_at_idx" ON "ge_price_history" USING btree ("captured_at");
