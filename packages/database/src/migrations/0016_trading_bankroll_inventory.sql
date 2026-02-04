-- Trading Bankroll table for tracking liquidity/GP used for flipping
CREATE TABLE IF NOT EXISTS "ge_trading_bankroll" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_character_id" uuid NOT NULL UNIQUE,
  "current_bankroll" bigint DEFAULT 0 NOT NULL,
  "initial_bankroll" bigint DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "ge_trading_bankroll"
  ADD CONSTRAINT "ge_trading_bankroll_user_character_id_user_characters_id_fk"
  FOREIGN KEY ("user_character_id") REFERENCES "public"."user_characters"("id")
  ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ge_trading_bankroll_character_id_idx" ON "ge_trading_bankroll" USING btree ("user_character_id");
--> statement-breakpoint

-- Inventory Positions table for tracking held items with quantities
CREATE TABLE IF NOT EXISTS "ge_inventory_positions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_character_id" uuid NOT NULL,
  "item_id" integer NOT NULL,
  "item_name" text NOT NULL,
  "total_quantity" integer NOT NULL,
  "remaining_quantity" integer NOT NULL,
  "average_buy_price" integer NOT NULL,
  "total_cost" bigint NOT NULL,
  "first_buy_at" timestamp with time zone NOT NULL,
  "last_buy_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "ge_inventory_positions"
  ADD CONSTRAINT "ge_inventory_positions_user_character_id_user_characters_id_fk"
  FOREIGN KEY ("user_character_id") REFERENCES "public"."user_characters"("id")
  ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "ge_inventory_positions"
ADD CONSTRAINT "ge_inventory_positions_character_item_unique" UNIQUE ("user_character_id", "item_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ge_inventory_positions_character_id_idx" ON "ge_inventory_positions" USING btree ("user_character_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ge_inventory_positions_character_remaining_idx" ON "ge_inventory_positions" USING btree ("user_character_id", "remaining_quantity");
