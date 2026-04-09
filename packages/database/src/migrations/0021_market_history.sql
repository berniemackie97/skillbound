-- Market History: persisted price snapshots and daily summaries
-- Enables long-term trend analysis, seasonality detection, and pattern recognition

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
  CONSTRAINT "ge_price_history_item_captured_unique" UNIQUE("item_id", "captured_at")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ge_price_history_item_captured_at_idx" ON "ge_price_history" USING btree ("item_id", "captured_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ge_price_history_captured_at_idx" ON "ge_price_history" USING btree ("captured_at");
--> statement-breakpoint

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
  CONSTRAINT "ge_daily_summary_item_date_unique" UNIQUE("item_id", "date")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ge_daily_summary_item_date_idx" ON "ge_daily_summary" USING btree ("item_id", "date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ge_daily_summary_date_idx" ON "ge_daily_summary" USING btree ("date");
--> statement-breakpoint

-- New quality columns for flip scoring
ALTER TABLE "ge_flip_suggestions" ADD COLUMN IF NOT EXISTS "quality_volume_anomaly" integer;
--> statement-breakpoint
ALTER TABLE "ge_flip_suggestions" ADD COLUMN IF NOT EXISTS "quality_price_consistency" integer;
--> statement-breakpoint
ALTER TABLE "ge_flip_suggestions" ADD COLUMN IF NOT EXISTS "quality_historical_reliability" integer;
