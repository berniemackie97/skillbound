CREATE TABLE IF NOT EXISTS "character_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"display_name" text NOT NULL,
	"mode" "account_mode" DEFAULT 'normal' NOT NULL,
	"last_synced_at" timestamp with time zone,
	"wom_backfill_checked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "character_profiles_display_name_mode_unique" UNIQUE("display_name","mode")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_characters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"notes" text,
	"is_public" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_characters_user_profile_unique" UNIQUE("user_id","profile_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "snapshot_archives" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"source_tier" "snapshot_retention_tier" NOT NULL,
	"target_tier" "snapshot_retention_tier",
	"reason" text NOT NULL,
	"bucket_key" text NOT NULL,
	"captured_from" timestamp with time zone NOT NULL,
	"captured_to" timestamp with time zone NOT NULL,
	"snapshot_count" integer NOT NULL,
	"storage_provider" text NOT NULL,
	"storage_bucket" text NOT NULL,
	"storage_key" text NOT NULL,
	"storage_region" text,
	"storage_endpoint" text,
	"checksum" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"compressed" boolean DEFAULT true NOT NULL,
	"archive_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "snapshot_archives_profile_source_reason_bucket_unique" UNIQUE("profile_id","source_tier","reason","bucket_key")
);
--> statement-breakpoint
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
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ge_inventory_positions_character_item_unique" UNIQUE("user_character_id","item_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ge_trading_bankroll" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_character_id" uuid NOT NULL,
	"current_bankroll" bigint DEFAULT 0 NOT NULL,
	"initial_bankroll" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ge_trading_bankroll_user_character_id_unique" UNIQUE("user_character_id")
);
--> statement-breakpoint
ALTER TABLE IF EXISTS "characters" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE IF EXISTS "characters" CASCADE;--> statement-breakpoint
ALTER TABLE "character_state" DROP CONSTRAINT IF EXISTS "character_state_char_domain_key_unique";--> statement-breakpoint
ALTER TABLE "character_overrides" DROP CONSTRAINT IF EXISTS "overrides_character_type_key_unique";--> statement-breakpoint
ALTER TABLE "guide_progress" DROP CONSTRAINT IF EXISTS "guide_progress_character_guide_version_unique";--> statement-breakpoint
ALTER TABLE "character_progression_items" DROP CONSTRAINT IF EXISTS "progression_items_char_cat_name_unique";--> statement-breakpoint
ALTER TABLE "boss_killcounts" DROP CONSTRAINT IF EXISTS "boss_kc_character_boss_unique";--> statement-breakpoint
ALTER TABLE "collection_log_items" DROP CONSTRAINT IF EXISTS "coll_log_character_item_source_unique";--> statement-breakpoint
ALTER TABLE "gear_progression" DROP CONSTRAINT IF EXISTS "gear_prog_character_stage_slot_item_unique";--> statement-breakpoint
ALTER TABLE "milestones" DROP CONSTRAINT IF EXISTS "milestones_character_name_unique";--> statement-breakpoint
ALTER TABLE "ge_watch_items" DROP CONSTRAINT IF EXISTS "ge_watch_items_character_item_unique";--> statement-breakpoint
ALTER TABLE "user_settings" DROP CONSTRAINT IF EXISTS "user_settings_active_character_id_characters_id_fk";--> statement-breakpoint
ALTER TABLE "character_state" DROP CONSTRAINT IF EXISTS "character_state_character_id_characters_id_fk";--> statement-breakpoint
ALTER TABLE "character_snapshots" DROP CONSTRAINT IF EXISTS "character_snapshots_character_id_characters_id_fk";--> statement-breakpoint
ALTER TABLE "character_overrides" DROP CONSTRAINT IF EXISTS "character_overrides_character_id_characters_id_fk";--> statement-breakpoint
ALTER TABLE "guide_progress" DROP CONSTRAINT IF EXISTS "guide_progress_character_id_characters_id_fk";--> statement-breakpoint
ALTER TABLE "character_progression_items" DROP CONSTRAINT IF EXISTS "character_progression_items_character_id_characters_id_fk";--> statement-breakpoint
ALTER TABLE "boss_killcounts" DROP CONSTRAINT IF EXISTS "boss_killcounts_character_id_characters_id_fk";--> statement-breakpoint
ALTER TABLE "collection_log_items" DROP CONSTRAINT IF EXISTS "collection_log_items_character_id_characters_id_fk";--> statement-breakpoint
ALTER TABLE "gear_progression" DROP CONSTRAINT IF EXISTS "gear_progression_character_id_characters_id_fk";--> statement-breakpoint
ALTER TABLE "milestones" DROP CONSTRAINT IF EXISTS "milestones_character_id_characters_id_fk";--> statement-breakpoint
ALTER TABLE "ge_trades" DROP CONSTRAINT IF EXISTS "ge_trades_character_id_characters_id_fk";--> statement-breakpoint
ALTER TABLE "ge_watch_items" DROP CONSTRAINT IF EXISTS "ge_watch_items_character_id_characters_id_fk";--> statement-breakpoint
DROP INDEX IF EXISTS "snapshots_character_captured_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "snapshots_character_milestone_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "snapshots_character_captured_desc_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "character_state_char_domain_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "character_state_character_id_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "character_state_char_achieved_at_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "overrides_character_type_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "guide_progress_character_id_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "progression_items_character_id_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "progression_items_character_completed_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "progression_items_char_type_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "progression_items_char_order_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "boss_kc_character_id_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "coll_log_character_id_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "coll_log_character_source_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "coll_log_character_obtained_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "gear_prog_character_id_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "gear_prog_character_stage_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "gear_prog_character_slot_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "gear_prog_character_obtained_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "milestones_character_id_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "milestones_character_difficulty_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "milestones_character_achieved_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "ge_trades_character_id_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "ge_trades_character_item_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "ge_trades_character_traded_at_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "ge_trades_character_type_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "ge_watch_items_character_id_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "ge_watch_items_character_active_idx";--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "character_sync_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "character_sync_interval_hours" integer DEFAULT 24 NOT NULL;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "ge_presets" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "ge_refresh_interval_ms" integer DEFAULT 45000 NOT NULL;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "ge_refresh_paused" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "character_state" ADD COLUMN IF NOT EXISTS "user_character_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "character_snapshots" ADD COLUMN IF NOT EXISTS "profile_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "character_overrides" ADD COLUMN IF NOT EXISTS "user_character_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "guide_progress" ADD COLUMN IF NOT EXISTS "user_character_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "quest_definitions" ADD COLUMN IF NOT EXISTS "quest_points" integer;--> statement-breakpoint
ALTER TABLE "character_progression_items" ADD COLUMN IF NOT EXISTS "user_character_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "boss_killcounts" ADD COLUMN IF NOT EXISTS "user_character_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "collection_log_items" ADD COLUMN IF NOT EXISTS "user_character_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "gear_progression" ADD COLUMN IF NOT EXISTS "user_character_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "milestones" ADD COLUMN IF NOT EXISTS "user_character_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "ge_trades" ADD COLUMN IF NOT EXISTS "user_character_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "ge_watch_items" ADD COLUMN IF NOT EXISTS "user_character_id" uuid NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_characters" ADD CONSTRAINT "user_characters_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_characters" ADD CONSTRAINT "user_characters_profile_id_character_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."character_profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "snapshot_archives" ADD CONSTRAINT "snapshot_archives_profile_id_character_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."character_profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ge_inventory_positions" ADD CONSTRAINT "ge_inventory_positions_user_character_id_user_characters_id_fk" FOREIGN KEY ("user_character_id") REFERENCES "public"."user_characters"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ge_trading_bankroll" ADD CONSTRAINT "ge_trading_bankroll_user_character_id_user_characters_id_fk" FOREIGN KEY ("user_character_id") REFERENCES "public"."user_characters"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "character_profiles_display_name_idx" ON "character_profiles" USING btree ("display_name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "character_profiles_last_synced_at_idx" ON "character_profiles" USING btree ("last_synced_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_characters_user_id_idx" ON "user_characters" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_characters_profile_id_idx" ON "user_characters" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_characters_is_public_idx" ON "user_characters" USING btree ("is_public");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_characters_archived_at_idx" ON "user_characters" USING btree ("archived_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "snapshot_archives_profile_idx" ON "snapshot_archives" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "snapshot_archives_source_tier_idx" ON "snapshot_archives" USING btree ("source_tier");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "snapshot_archives_bucket_idx" ON "snapshot_archives" USING btree ("bucket_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "snapshot_archives_created_at_idx" ON "snapshot_archives" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ge_inventory_positions_character_id_idx" ON "ge_inventory_positions" USING btree ("user_character_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ge_inventory_positions_character_remaining_idx" ON "ge_inventory_positions" USING btree ("user_character_id","remaining_quantity");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ge_trading_bankroll_character_id_idx" ON "ge_trading_bankroll" USING btree ("user_character_id");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_active_character_id_user_characters_id_fk" FOREIGN KEY ("active_character_id") REFERENCES "public"."user_characters"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "character_state" ADD CONSTRAINT "character_state_user_character_id_user_characters_id_fk" FOREIGN KEY ("user_character_id") REFERENCES "public"."user_characters"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "character_snapshots" ADD CONSTRAINT "character_snapshots_profile_id_character_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."character_profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "character_overrides" ADD CONSTRAINT "character_overrides_user_character_id_user_characters_id_fk" FOREIGN KEY ("user_character_id") REFERENCES "public"."user_characters"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "guide_progress" ADD CONSTRAINT "guide_progress_user_character_id_user_characters_id_fk" FOREIGN KEY ("user_character_id") REFERENCES "public"."user_characters"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "character_progression_items" ADD CONSTRAINT "character_progression_items_user_character_id_user_characters_id_fk" FOREIGN KEY ("user_character_id") REFERENCES "public"."user_characters"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "boss_killcounts" ADD CONSTRAINT "boss_killcounts_user_character_id_user_characters_id_fk" FOREIGN KEY ("user_character_id") REFERENCES "public"."user_characters"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "collection_log_items" ADD CONSTRAINT "collection_log_items_user_character_id_user_characters_id_fk" FOREIGN KEY ("user_character_id") REFERENCES "public"."user_characters"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "gear_progression" ADD CONSTRAINT "gear_progression_user_character_id_user_characters_id_fk" FOREIGN KEY ("user_character_id") REFERENCES "public"."user_characters"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "milestones" ADD CONSTRAINT "milestones_user_character_id_user_characters_id_fk" FOREIGN KEY ("user_character_id") REFERENCES "public"."user_characters"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ge_trades" ADD CONSTRAINT "ge_trades_user_character_id_user_characters_id_fk" FOREIGN KEY ("user_character_id") REFERENCES "public"."user_characters"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ge_watch_items" ADD CONSTRAINT "ge_watch_items_user_character_id_user_characters_id_fk" FOREIGN KEY ("user_character_id") REFERENCES "public"."user_characters"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "snapshots_profile_captured_idx" ON "character_snapshots" USING btree ("profile_id","captured_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "snapshots_profile_milestone_idx" ON "character_snapshots" USING btree ("profile_id","is_milestone");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "snapshots_profile_captured_desc_idx" ON "character_snapshots" USING btree ("profile_id","captured_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "character_state_char_domain_idx" ON "character_state" USING btree ("user_character_id","domain");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "character_state_character_id_idx" ON "character_state" USING btree ("user_character_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "character_state_char_achieved_at_idx" ON "character_state" USING btree ("user_character_id","achieved_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "overrides_character_type_idx" ON "character_overrides" USING btree ("user_character_id","type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "guide_progress_character_id_idx" ON "guide_progress" USING btree ("user_character_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "progression_items_character_id_idx" ON "character_progression_items" USING btree ("user_character_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "progression_items_character_completed_idx" ON "character_progression_items" USING btree ("user_character_id","completed");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "progression_items_char_type_idx" ON "character_progression_items" USING btree ("user_character_id","item_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "progression_items_char_order_idx" ON "character_progression_items" USING btree ("user_character_id","order_index");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "boss_kc_character_id_idx" ON "boss_killcounts" USING btree ("user_character_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "coll_log_character_id_idx" ON "collection_log_items" USING btree ("user_character_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "coll_log_character_source_idx" ON "collection_log_items" USING btree ("user_character_id","source");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "coll_log_character_obtained_idx" ON "collection_log_items" USING btree ("user_character_id","obtained");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gear_prog_character_id_idx" ON "gear_progression" USING btree ("user_character_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gear_prog_character_stage_idx" ON "gear_progression" USING btree ("user_character_id","game_stage");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gear_prog_character_slot_idx" ON "gear_progression" USING btree ("user_character_id","slot");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gear_prog_character_obtained_idx" ON "gear_progression" USING btree ("user_character_id","obtained");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "milestones_character_id_idx" ON "milestones" USING btree ("user_character_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "milestones_character_difficulty_idx" ON "milestones" USING btree ("user_character_id","difficulty");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "milestones_character_achieved_idx" ON "milestones" USING btree ("user_character_id","achieved");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ge_trades_character_id_idx" ON "ge_trades" USING btree ("user_character_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ge_trades_character_item_idx" ON "ge_trades" USING btree ("user_character_id","item_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ge_trades_character_traded_at_idx" ON "ge_trades" USING btree ("user_character_id","traded_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ge_trades_character_type_idx" ON "ge_trades" USING btree ("user_character_id","trade_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ge_watch_items_character_id_idx" ON "ge_watch_items" USING btree ("user_character_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ge_watch_items_character_active_idx" ON "ge_watch_items" USING btree ("user_character_id","is_active");--> statement-breakpoint
ALTER TABLE "character_state" DROP COLUMN IF EXISTS "character_id";--> statement-breakpoint
ALTER TABLE "character_snapshots" DROP COLUMN IF EXISTS "character_id";--> statement-breakpoint
ALTER TABLE "character_overrides" DROP COLUMN IF EXISTS "character_id";--> statement-breakpoint
ALTER TABLE "guide_progress" DROP COLUMN IF EXISTS "character_id";--> statement-breakpoint
ALTER TABLE "character_progression_items" DROP COLUMN IF EXISTS "character_id";--> statement-breakpoint
ALTER TABLE "boss_killcounts" DROP COLUMN IF EXISTS "character_id";--> statement-breakpoint
ALTER TABLE "collection_log_items" DROP COLUMN IF EXISTS "character_id";--> statement-breakpoint
ALTER TABLE "gear_progression" DROP COLUMN IF EXISTS "character_id";--> statement-breakpoint
ALTER TABLE "milestones" DROP COLUMN IF EXISTS "character_id";--> statement-breakpoint
ALTER TABLE "ge_trades" DROP COLUMN IF EXISTS "character_id";--> statement-breakpoint
ALTER TABLE "ge_watch_items" DROP COLUMN IF EXISTS "character_id";--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "character_state" ADD CONSTRAINT "character_state_char_domain_key_unique" UNIQUE("user_character_id","domain","key");
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "character_overrides" ADD CONSTRAINT "overrides_character_type_key_unique" UNIQUE("user_character_id","type","key");
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "guide_progress" ADD CONSTRAINT "guide_progress_character_guide_version_unique" UNIQUE("user_character_id","guide_template_id","guide_version");
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "character_progression_items" ADD CONSTRAINT "progression_items_char_cat_name_unique" UNIQUE("user_character_id","category_id","name");
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "boss_killcounts" ADD CONSTRAINT "boss_kc_character_boss_unique" UNIQUE("user_character_id","boss_name");
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "collection_log_items" ADD CONSTRAINT "coll_log_character_item_source_unique" UNIQUE("user_character_id","item_id","source");
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "gear_progression" ADD CONSTRAINT "gear_prog_character_stage_slot_item_unique" UNIQUE("user_character_id","game_stage","slot","item_id");
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "milestones" ADD CONSTRAINT "milestones_character_name_unique" UNIQUE("user_character_id","name");
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ge_watch_items" ADD CONSTRAINT "ge_watch_items_character_item_unique" UNIQUE("user_character_id","item_id");
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
