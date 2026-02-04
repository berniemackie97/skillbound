CREATE TYPE "public"."character_state_domain" AS ENUM('skill', 'boss', 'activity', 'quest', 'diary', 'diary_task', 'combat_achievement', 'collection_log', 'item_unlock', 'gear', 'guide_step', 'milestone', 'goal', 'unlock_flag', 'custom');--> statement-breakpoint
CREATE TYPE "public"."character_state_source" AS ENUM('hiscores', 'runelite', 'wiki', 'guide', 'manual', 'calculated', 'migration');--> statement-breakpoint
CREATE TYPE "public"."snapshot_retention_tier" AS ENUM('realtime', 'hourly', 'daily', 'weekly', 'monthly', 'milestone');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "character_state" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"character_id" uuid NOT NULL,
	"domain" character_state_domain NOT NULL,
	"key" text NOT NULL,
	"value" jsonb NOT NULL,
	"source" character_state_source DEFAULT 'manual' NOT NULL,
	"source_id" text,
	"confidence" text DEFAULT 'medium',
	"note" text,
	"achieved_at" timestamp with time zone,
	"synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "character_state_char_domain_key_unique" UNIQUE("character_id","domain","key")
);
--> statement-breakpoint
DROP INDEX IF EXISTS "snapshots_character_id_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "snapshots_captured_at_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "overrides_character_id_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "overrides_type_key_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "overrides_character_type_key_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "boss_kc_character_boss_idx";--> statement-breakpoint
-- Convert text 'true'/'false' to boolean: drop default first, change type, then set new default
ALTER TABLE "characters" ALTER COLUMN "is_public" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "characters" ALTER COLUMN "is_public" SET DATA TYPE boolean USING ("is_public" = 'true');--> statement-breakpoint
ALTER TABLE "characters" ALTER COLUMN "is_public" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "character_snapshots" ADD COLUMN "retention_tier" "snapshot_retention_tier" DEFAULT 'realtime' NOT NULL;--> statement-breakpoint
ALTER TABLE "character_snapshots" ADD COLUMN "is_milestone" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "character_snapshots" ADD COLUMN "milestone_type" text;--> statement-breakpoint
ALTER TABLE "character_snapshots" ADD COLUMN "milestone_data" jsonb;--> statement-breakpoint
ALTER TABLE "character_snapshots" ADD COLUMN "expires_at" timestamp with time zone;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "character_state" ADD CONSTRAINT "character_state_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "character_state_char_domain_idx" ON "character_state" USING btree ("character_id","domain");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "character_state_character_id_idx" ON "character_state" USING btree ("character_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "character_state_source_idx" ON "character_state" USING btree ("source");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "character_state_domain_key_idx" ON "character_state" USING btree ("domain","key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "character_state_updated_at_idx" ON "character_state" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "character_state_char_achieved_at_idx" ON "character_state" USING btree ("character_id","achieved_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "characters_is_public_idx" ON "characters" USING btree ("is_public");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "characters_user_public_idx" ON "characters" USING btree ("user_id","is_public");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "characters_last_synced_at_idx" ON "characters" USING btree ("last_synced_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "snapshots_retention_tier_idx" ON "character_snapshots" USING btree ("retention_tier");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "snapshots_expires_at_idx" ON "character_snapshots" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "snapshots_character_milestone_idx" ON "character_snapshots" USING btree ("character_id","is_milestone");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "snapshots_data_source_idx" ON "character_snapshots" USING btree ("data_source");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "snapshots_character_captured_desc_idx" ON "character_snapshots" USING btree ("character_id","captured_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "snapshots_total_level_idx" ON "character_snapshots" USING btree ("total_level");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "snapshots_total_xp_idx" ON "character_snapshots" USING btree ("total_xp");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "overrides_character_type_idx" ON "character_overrides" USING btree ("character_id","type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "overrides_type_idx" ON "character_overrides" USING btree ("type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "guide_progress_completed_at_idx" ON "guide_progress" USING btree ("completed_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "guide_progress_updated_at_idx" ON "guide_progress" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "guide_templates_title_idx" ON "guide_templates" USING btree ("title");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "progression_items_char_type_idx" ON "character_progression_items" USING btree ("character_id","item_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "progression_items_char_order_idx" ON "character_progression_items" USING btree ("character_id","order_index");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "progression_items_unlock_flag_idx" ON "character_progression_items" USING btree ("unlock_flag");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "progression_categories_order_idx" ON "progression_categories" USING btree ("order_index");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "boss_kc_boss_name_idx" ON "boss_killcounts" USING btree ("boss_name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "coll_log_item_id_idx" ON "collection_log_items" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gear_prog_character_slot_idx" ON "gear_progression" USING btree ("character_id","slot");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gear_prog_character_obtained_idx" ON "gear_progression" USING btree ("character_id","obtained");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "milestones_category_id_idx" ON "milestones" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ge_trades_character_traded_at_idx" ON "ge_trades" USING btree ("character_id","traded_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ge_trades_matched_trade_id_idx" ON "ge_trades" USING btree ("matched_trade_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ge_trades_character_type_idx" ON "ge_trades" USING btree ("character_id","trade_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ge_watch_items_item_id_idx" ON "ge_watch_items" USING btree ("item_id");--> statement-breakpoint
-- Clean up duplicate data before adding unique constraints
-- Keep the row with the highest killcount (or most recent update) for boss_killcounts
DELETE FROM "boss_killcounts" a USING "boss_killcounts" b
WHERE a.id < b.id
AND a.character_id = b.character_id
AND a.boss_name = b.boss_name;--> statement-breakpoint

-- Clean up duplicate collection_log_items (keep most recent)
DELETE FROM "collection_log_items" a USING "collection_log_items" b
WHERE a.id < b.id
AND a.character_id = b.character_id
AND a.item_id = b.item_id
AND a.source = b.source;--> statement-breakpoint

-- Clean up duplicate gear_progression (keep most recent)
DELETE FROM "gear_progression" a USING "gear_progression" b
WHERE a.id < b.id
AND a.character_id = b.character_id
AND a.game_stage = b.game_stage
AND a.slot = b.slot
AND a.item_id = b.item_id;--> statement-breakpoint

-- Clean up duplicate milestones (keep most recent)
DELETE FROM "milestones" a USING "milestones" b
WHERE a.id < b.id
AND a.character_id = b.character_id
AND a.name = b.name;--> statement-breakpoint

-- Clean up duplicate ge_watch_items (keep most recent)
DELETE FROM "ge_watch_items" a USING "ge_watch_items" b
WHERE a.id < b.id
AND a.character_id = b.character_id
AND a.item_id = b.item_id;--> statement-breakpoint

-- Clean up duplicate guide_progress (keep most recent)
DELETE FROM "guide_progress" a USING "guide_progress" b
WHERE a.id < b.id
AND a.character_id = b.character_id
AND a.guide_template_id = b.guide_template_id
AND a.guide_version = b.guide_version;--> statement-breakpoint

-- Clean up duplicate character_overrides (keep most recent)
DELETE FROM "character_overrides" a USING "character_overrides" b
WHERE a.id < b.id
AND a.character_id = b.character_id
AND a.type = b.type
AND a.key = b.key;--> statement-breakpoint

-- Clean up duplicate progression_categories (keep first)
DELETE FROM "progression_categories" a USING "progression_categories" b
WHERE a.id > b.id
AND a.name = b.name;--> statement-breakpoint

-- Clean up duplicate guide_templates (keep first version)
DELETE FROM "guide_templates" a USING "guide_templates" b
WHERE a.id > b.id
AND a.title = b.title
AND a.version = b.version;--> statement-breakpoint

-- Clean up duplicate character_progression_items (keep most recent)
DELETE FROM "character_progression_items" a USING "character_progression_items" b
WHERE a.id < b.id
AND a.character_id = b.character_id
AND a.category_id = b.category_id
AND a.name = b.name;--> statement-breakpoint

-- Now add the unique constraints
ALTER TABLE "character_overrides" ADD CONSTRAINT "overrides_character_type_key_unique" UNIQUE("character_id","type","key");--> statement-breakpoint
ALTER TABLE "guide_progress" ADD CONSTRAINT "guide_progress_character_guide_version_unique" UNIQUE("character_id","guide_template_id","guide_version");--> statement-breakpoint
ALTER TABLE "guide_templates" ADD CONSTRAINT "guide_templates_title_version_unique" UNIQUE("title","version");--> statement-breakpoint
ALTER TABLE "character_progression_items" ADD CONSTRAINT "progression_items_char_cat_name_unique" UNIQUE("character_id","category_id","name");--> statement-breakpoint
ALTER TABLE "progression_categories" ADD CONSTRAINT "progression_categories_name_unique" UNIQUE("name");--> statement-breakpoint
ALTER TABLE "boss_killcounts" ADD CONSTRAINT "boss_kc_character_boss_unique" UNIQUE("character_id","boss_name");--> statement-breakpoint
ALTER TABLE "collection_log_items" ADD CONSTRAINT "coll_log_character_item_source_unique" UNIQUE("character_id","item_id","source");--> statement-breakpoint
ALTER TABLE "gear_progression" ADD CONSTRAINT "gear_prog_character_stage_slot_item_unique" UNIQUE("character_id","game_stage","slot","item_id");--> statement-breakpoint
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_character_name_unique" UNIQUE("character_id","name");--> statement-breakpoint
ALTER TABLE "ge_watch_items" ADD CONSTRAINT "ge_watch_items_character_item_unique" UNIQUE("character_id","item_id");