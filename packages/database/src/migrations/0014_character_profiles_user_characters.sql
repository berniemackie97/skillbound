-- Split character data into global profiles + per-user ownership records

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
CREATE INDEX IF NOT EXISTS "character_profiles_display_name_idx" ON "character_profiles" USING btree ("display_name");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "character_profiles_last_synced_at_idx" ON "character_profiles" USING btree ("last_synced_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_characters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"notes" text,
	"is_public" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_characters_user_profile_unique" UNIQUE("user_id","profile_id")
);
--> statement-breakpoint
ALTER TABLE "user_characters" ADD CONSTRAINT "user_characters_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "user_characters" ADD CONSTRAINT "user_characters_profile_id_character_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."character_profiles"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_characters_user_id_idx" ON "user_characters" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_characters_profile_id_idx" ON "user_characters" USING btree ("profile_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_characters_is_public_idx" ON "user_characters" USING btree ("is_public");
--> statement-breakpoint

-- Backfill character profiles from existing characters
INSERT INTO "character_profiles" ("display_name","mode","last_synced_at","wom_backfill_checked_at","created_at","updated_at")
SELECT
	c."display_name",
	c."mode",
	MAX(c."last_synced_at") AS "last_synced_at",
	MAX(c."wom_backfill_checked_at") AS "wom_backfill_checked_at",
	MIN(c."created_at") AS "created_at",
	MAX(c."updated_at") AS "updated_at"
FROM "characters" c
GROUP BY c."display_name", c."mode"
ON CONFLICT ("display_name","mode") DO NOTHING;
--> statement-breakpoint

-- Backfill user-owned character records from existing characters
WITH ranked AS (
	SELECT
		c.*,
		cp."id" AS "profile_id",
		ROW_NUMBER() OVER (
			PARTITION BY c."user_id", cp."id"
			ORDER BY c."updated_at" DESC NULLS LAST, c."created_at" DESC NULLS LAST
		) AS rn
	FROM "characters" c
	JOIN "character_profiles" cp
		ON cp."display_name" = c."display_name"
	 AND cp."mode" = c."mode"
	WHERE c."user_id" IS NOT NULL
)
INSERT INTO "user_characters" ("user_id","profile_id","tags","notes","is_public","created_at","updated_at")
SELECT
	"user_id",
	"profile_id",
	"tags",
	"notes",
	"is_public",
	"created_at",
	"updated_at"
FROM ranked
WHERE rn = 1
ON CONFLICT ("user_id","profile_id") DO NOTHING;
--> statement-breakpoint

-- Map snapshots to profiles
ALTER TABLE "character_snapshots" ADD COLUMN IF NOT EXISTS "profile_id" uuid;
--> statement-breakpoint
UPDATE "character_snapshots" cs
SET "profile_id" = cp."id"
FROM "characters" c
JOIN "character_profiles" cp
	ON cp."display_name" = c."display_name"
 AND cp."mode" = c."mode"
WHERE cs."character_id" = c."id"
	AND cs."profile_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "character_snapshots" ALTER COLUMN "profile_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "character_snapshots" DROP CONSTRAINT IF EXISTS "character_snapshots_character_id_characters_id_fk";
--> statement-breakpoint
ALTER TABLE "character_snapshots" DROP COLUMN IF EXISTS "character_id";
--> statement-breakpoint
ALTER TABLE "character_snapshots" ADD CONSTRAINT "character_snapshots_profile_id_character_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."character_profiles"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "snapshots_profile_captured_idx" ON "character_snapshots" USING btree ("profile_id","captured_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "snapshots_profile_milestone_idx" ON "character_snapshots" USING btree ("profile_id","is_milestone");
--> statement-breakpoint

-- Map overrides to user characters
ALTER TABLE "character_overrides" ADD COLUMN IF NOT EXISTS "user_character_id" uuid;
--> statement-breakpoint
UPDATE "character_overrides" co
SET "user_character_id" = uc."id"
FROM "characters" c
JOIN "character_profiles" cp
	ON cp."display_name" = c."display_name"
 AND cp."mode" = c."mode"
JOIN "user_characters" uc
	ON uc."user_id" = c."user_id"
 AND uc."profile_id" = cp."id"
WHERE co."character_id" = c."id"
	AND co."user_character_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "character_overrides" ALTER COLUMN "user_character_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "character_overrides" DROP CONSTRAINT IF EXISTS "character_overrides_character_id_characters_id_fk";
--> statement-breakpoint
ALTER TABLE "character_overrides" DROP CONSTRAINT IF EXISTS "overrides_character_type_key_unique";
--> statement-breakpoint
ALTER TABLE "character_overrides" DROP COLUMN IF EXISTS "character_id";
--> statement-breakpoint
ALTER TABLE "character_overrides" ADD CONSTRAINT "character_overrides_user_character_id_user_characters_id_fk" FOREIGN KEY ("user_character_id") REFERENCES "public"."user_characters"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "character_overrides" ADD CONSTRAINT "overrides_character_type_key_unique" UNIQUE("user_character_id","type","key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "overrides_character_type_idx" ON "character_overrides" USING btree ("user_character_id","type");
--> statement-breakpoint

-- Map guide progress to user characters
ALTER TABLE "guide_progress" ADD COLUMN IF NOT EXISTS "user_character_id" uuid;
--> statement-breakpoint
UPDATE "guide_progress" gp
SET "user_character_id" = uc."id"
FROM "characters" c
JOIN "character_profiles" cp
	ON cp."display_name" = c."display_name"
 AND cp."mode" = c."mode"
JOIN "user_characters" uc
	ON uc."user_id" = c."user_id"
 AND uc."profile_id" = cp."id"
WHERE gp."character_id" = c."id"
	AND gp."user_character_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "guide_progress" ALTER COLUMN "user_character_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "guide_progress" DROP CONSTRAINT IF EXISTS "guide_progress_character_id_characters_id_fk";
--> statement-breakpoint
ALTER TABLE "guide_progress" DROP CONSTRAINT IF EXISTS "guide_progress_character_guide_version_unique";
--> statement-breakpoint
ALTER TABLE "guide_progress" DROP COLUMN IF EXISTS "character_id";
--> statement-breakpoint
ALTER TABLE "guide_progress" ADD CONSTRAINT "guide_progress_user_character_id_user_characters_id_fk" FOREIGN KEY ("user_character_id") REFERENCES "public"."user_characters"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "guide_progress" ADD CONSTRAINT "guide_progress_character_guide_version_unique" UNIQUE("user_character_id","guide_template_id","guide_version");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "guide_progress_character_id_idx" ON "guide_progress" USING btree ("user_character_id");
--> statement-breakpoint

-- Map progression items to user characters
ALTER TABLE "character_progression_items" ADD COLUMN IF NOT EXISTS "user_character_id" uuid;
--> statement-breakpoint
UPDATE "character_progression_items" cpi
SET "user_character_id" = uc."id"
FROM "characters" c
JOIN "character_profiles" cp
	ON cp."display_name" = c."display_name"
 AND cp."mode" = c."mode"
JOIN "user_characters" uc
	ON uc."user_id" = c."user_id"
 AND uc."profile_id" = cp."id"
WHERE cpi."character_id" = c."id"
	AND cpi."user_character_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "character_progression_items" ALTER COLUMN "user_character_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "character_progression_items" DROP CONSTRAINT IF EXISTS "character_progression_items_character_id_characters_id_fk";
--> statement-breakpoint
ALTER TABLE "character_progression_items" DROP CONSTRAINT IF EXISTS "progression_items_char_cat_name_unique";
--> statement-breakpoint
ALTER TABLE "character_progression_items" DROP COLUMN IF EXISTS "character_id";
--> statement-breakpoint
ALTER TABLE "character_progression_items" ADD CONSTRAINT "character_progression_items_user_character_id_user_characters_id_fk" FOREIGN KEY ("user_character_id") REFERENCES "public"."user_characters"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "character_progression_items" ADD CONSTRAINT "progression_items_char_cat_name_unique" UNIQUE("user_character_id","category_id","name");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "progression_items_character_id_idx" ON "character_progression_items" USING btree ("user_character_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "progression_items_character_completed_idx" ON "character_progression_items" USING btree ("user_character_id","completed");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "progression_items_char_type_idx" ON "character_progression_items" USING btree ("user_character_id","item_type");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "progression_items_char_order_idx" ON "character_progression_items" USING btree ("user_character_id","order_index");
--> statement-breakpoint

-- Map progression extended tables
ALTER TABLE "boss_killcounts" ADD COLUMN IF NOT EXISTS "user_character_id" uuid;
--> statement-breakpoint
UPDATE "boss_killcounts" bkc
SET "user_character_id" = uc."id"
FROM "characters" c
JOIN "character_profiles" cp
	ON cp."display_name" = c."display_name"
 AND cp."mode" = c."mode"
JOIN "user_characters" uc
	ON uc."user_id" = c."user_id"
 AND uc."profile_id" = cp."id"
WHERE bkc."character_id" = c."id"
	AND bkc."user_character_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "boss_killcounts" ALTER COLUMN "user_character_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "boss_killcounts" DROP CONSTRAINT IF EXISTS "boss_killcounts_character_id_characters_id_fk";
--> statement-breakpoint
ALTER TABLE "boss_killcounts" DROP CONSTRAINT IF EXISTS "boss_kc_character_boss_unique";
--> statement-breakpoint
ALTER TABLE "boss_killcounts" DROP COLUMN IF EXISTS "character_id";
--> statement-breakpoint
ALTER TABLE "boss_killcounts" ADD CONSTRAINT "boss_killcounts_user_character_id_user_characters_id_fk" FOREIGN KEY ("user_character_id") REFERENCES "public"."user_characters"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "boss_killcounts" ADD CONSTRAINT "boss_kc_character_boss_unique" UNIQUE("user_character_id","boss_name");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "boss_kc_character_id_idx" ON "boss_killcounts" USING btree ("user_character_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "boss_kc_character_boss_idx" ON "boss_killcounts" USING btree ("user_character_id","boss_name");
--> statement-breakpoint

ALTER TABLE "collection_log_items" ADD COLUMN IF NOT EXISTS "user_character_id" uuid;
--> statement-breakpoint
UPDATE "collection_log_items" cli
SET "user_character_id" = uc."id"
FROM "characters" c
JOIN "character_profiles" cp
	ON cp."display_name" = c."display_name"
 AND cp."mode" = c."mode"
JOIN "user_characters" uc
	ON uc."user_id" = c."user_id"
 AND uc."profile_id" = cp."id"
WHERE cli."character_id" = c."id"
	AND cli."user_character_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "collection_log_items" ALTER COLUMN "user_character_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "collection_log_items" DROP CONSTRAINT IF EXISTS "collection_log_items_character_id_characters_id_fk";
--> statement-breakpoint
ALTER TABLE "collection_log_items" DROP CONSTRAINT IF EXISTS "coll_log_character_item_source_unique";
--> statement-breakpoint
ALTER TABLE "collection_log_items" DROP COLUMN IF EXISTS "character_id";
--> statement-breakpoint
ALTER TABLE "collection_log_items" ADD CONSTRAINT "collection_log_items_user_character_id_user_characters_id_fk" FOREIGN KEY ("user_character_id") REFERENCES "public"."user_characters"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "collection_log_items" ADD CONSTRAINT "coll_log_character_item_source_unique" UNIQUE("user_character_id","item_id","source");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "coll_log_character_id_idx" ON "collection_log_items" USING btree ("user_character_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "coll_log_character_source_idx" ON "collection_log_items" USING btree ("user_character_id","source");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "coll_log_character_obtained_idx" ON "collection_log_items" USING btree ("user_character_id","obtained");
--> statement-breakpoint

ALTER TABLE "gear_progression" ADD COLUMN IF NOT EXISTS "user_character_id" uuid;
--> statement-breakpoint
UPDATE "gear_progression" gp
SET "user_character_id" = uc."id"
FROM "characters" c
JOIN "character_profiles" cp
	ON cp."display_name" = c."display_name"
 AND cp."mode" = c."mode"
JOIN "user_characters" uc
	ON uc."user_id" = c."user_id"
 AND uc."profile_id" = cp."id"
WHERE gp."character_id" = c."id"
	AND gp."user_character_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "gear_progression" ALTER COLUMN "user_character_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "gear_progression" DROP CONSTRAINT IF EXISTS "gear_progression_character_id_characters_id_fk";
--> statement-breakpoint
ALTER TABLE "gear_progression" DROP CONSTRAINT IF EXISTS "gear_prog_character_stage_slot_item_unique";
--> statement-breakpoint
ALTER TABLE "gear_progression" DROP COLUMN IF EXISTS "character_id";
--> statement-breakpoint
ALTER TABLE "gear_progression" ADD CONSTRAINT "gear_progression_user_character_id_user_characters_id_fk" FOREIGN KEY ("user_character_id") REFERENCES "public"."user_characters"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "gear_progression" ADD CONSTRAINT "gear_prog_character_stage_slot_item_unique" UNIQUE("user_character_id","game_stage","slot","item_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gear_prog_character_id_idx" ON "gear_progression" USING btree ("user_character_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gear_prog_character_stage_idx" ON "gear_progression" USING btree ("user_character_id","game_stage");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gear_prog_character_slot_idx" ON "gear_progression" USING btree ("user_character_id","slot");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gear_prog_character_obtained_idx" ON "gear_progression" USING btree ("user_character_id","obtained");
--> statement-breakpoint

ALTER TABLE "milestones" ADD COLUMN IF NOT EXISTS "user_character_id" uuid;
--> statement-breakpoint
UPDATE "milestones" m
SET "user_character_id" = uc."id"
FROM "characters" c
JOIN "character_profiles" cp
	ON cp."display_name" = c."display_name"
 AND cp."mode" = c."mode"
JOIN "user_characters" uc
	ON uc."user_id" = c."user_id"
 AND uc."profile_id" = cp."id"
WHERE m."character_id" = c."id"
	AND m."user_character_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "milestones" ALTER COLUMN "user_character_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "milestones" DROP CONSTRAINT IF EXISTS "milestones_character_id_characters_id_fk";
--> statement-breakpoint
ALTER TABLE "milestones" DROP CONSTRAINT IF EXISTS "milestones_character_name_unique";
--> statement-breakpoint
ALTER TABLE "milestones" DROP COLUMN IF EXISTS "character_id";
--> statement-breakpoint
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_user_character_id_user_characters_id_fk" FOREIGN KEY ("user_character_id") REFERENCES "public"."user_characters"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_character_name_unique" UNIQUE("user_character_id","name");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "milestones_character_id_idx" ON "milestones" USING btree ("user_character_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "milestones_character_difficulty_idx" ON "milestones" USING btree ("user_character_id","difficulty");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "milestones_character_achieved_idx" ON "milestones" USING btree ("user_character_id","achieved");
--> statement-breakpoint

-- Map character state
ALTER TABLE "character_state" ADD COLUMN IF NOT EXISTS "user_character_id" uuid;
--> statement-breakpoint
UPDATE "character_state" cs
SET "user_character_id" = uc."id"
FROM "characters" c
JOIN "character_profiles" cp
	ON cp."display_name" = c."display_name"
 AND cp."mode" = c."mode"
JOIN "user_characters" uc
	ON uc."user_id" = c."user_id"
 AND uc."profile_id" = cp."id"
WHERE cs."character_id" = c."id"
	AND cs."user_character_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "character_state" ALTER COLUMN "user_character_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "character_state" DROP CONSTRAINT IF EXISTS "character_state_character_id_characters_id_fk";
--> statement-breakpoint
ALTER TABLE "character_state" DROP CONSTRAINT IF EXISTS "character_state_char_domain_key_unique";
--> statement-breakpoint
ALTER TABLE "character_state" DROP COLUMN IF EXISTS "character_id";
--> statement-breakpoint
ALTER TABLE "character_state" ADD CONSTRAINT "character_state_user_character_id_user_characters_id_fk" FOREIGN KEY ("user_character_id") REFERENCES "public"."user_characters"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "character_state" ADD CONSTRAINT "character_state_char_domain_key_unique" UNIQUE("user_character_id","domain","key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "character_state_char_domain_idx" ON "character_state" USING btree ("user_character_id","domain");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "character_state_character_id_idx" ON "character_state" USING btree ("user_character_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "character_state_char_achieved_at_idx" ON "character_state" USING btree ("user_character_id","achieved_at");
--> statement-breakpoint

-- Map trading tables
ALTER TABLE "ge_trades" ADD COLUMN IF NOT EXISTS "user_character_id" uuid;
--> statement-breakpoint
UPDATE "ge_trades" gt
SET "user_character_id" = uc."id"
FROM "characters" c
JOIN "character_profiles" cp
	ON cp."display_name" = c."display_name"
 AND cp."mode" = c."mode"
JOIN "user_characters" uc
	ON uc."user_id" = c."user_id"
 AND uc."profile_id" = cp."id"
WHERE gt."character_id" = c."id"
	AND gt."user_character_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "ge_trades" ALTER COLUMN "user_character_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "ge_trades" DROP CONSTRAINT IF EXISTS "ge_trades_character_id_characters_id_fk";
--> statement-breakpoint
ALTER TABLE "ge_trades" DROP COLUMN IF EXISTS "character_id";
--> statement-breakpoint
ALTER TABLE "ge_trades" ADD CONSTRAINT "ge_trades_user_character_id_user_characters_id_fk" FOREIGN KEY ("user_character_id") REFERENCES "public"."user_characters"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ge_trades_character_traded_at_idx" ON "ge_trades" USING btree ("user_character_id","traded_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ge_trades_character_type_idx" ON "ge_trades" USING btree ("user_character_id","trade_type");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ge_trades_character_item_idx" ON "ge_trades" USING btree ("user_character_id","item_id");
--> statement-breakpoint

ALTER TABLE "ge_watch_items" ADD COLUMN IF NOT EXISTS "user_character_id" uuid;
--> statement-breakpoint
UPDATE "ge_watch_items" gwi
SET "user_character_id" = uc."id"
FROM "characters" c
JOIN "character_profiles" cp
	ON cp."display_name" = c."display_name"
 AND cp."mode" = c."mode"
JOIN "user_characters" uc
	ON uc."user_id" = c."user_id"
 AND uc."profile_id" = cp."id"
WHERE gwi."character_id" = c."id"
	AND gwi."user_character_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "ge_watch_items" ALTER COLUMN "user_character_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "ge_watch_items" DROP CONSTRAINT IF EXISTS "ge_watch_items_character_id_characters_id_fk";
--> statement-breakpoint
ALTER TABLE "ge_watch_items" DROP CONSTRAINT IF EXISTS "ge_watch_items_character_item_unique";
--> statement-breakpoint
ALTER TABLE "ge_watch_items" DROP COLUMN IF EXISTS "character_id";
--> statement-breakpoint
ALTER TABLE "ge_watch_items" ADD CONSTRAINT "ge_watch_items_user_character_id_user_characters_id_fk" FOREIGN KEY ("user_character_id") REFERENCES "public"."user_characters"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ge_watch_items" ADD CONSTRAINT "ge_watch_items_character_item_unique" UNIQUE("user_character_id","item_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ge_watch_items_character_id_idx" ON "ge_watch_items" USING btree ("user_character_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ge_watch_items_character_active_idx" ON "ge_watch_items" USING btree ("user_character_id","is_active");
--> statement-breakpoint

-- Update active character references on user_settings
ALTER TABLE "user_settings" DROP CONSTRAINT IF EXISTS "user_settings_active_character_id_characters_id_fk";
--> statement-breakpoint
UPDATE "user_settings" us
SET "active_character_id" = uc."id"
FROM "characters" c
JOIN "character_profiles" cp
	ON cp."display_name" = c."display_name"
 AND cp."mode" = c."mode"
JOIN "user_characters" uc
	ON uc."user_id" = c."user_id"
 AND uc."profile_id" = cp."id"
WHERE us."active_character_id" = c."id";
--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_active_character_id_user_characters_id_fk" FOREIGN KEY ("active_character_id") REFERENCES "public"."user_characters"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint

-- Drop legacy character table now that ownership and profiles are split
DROP TABLE IF EXISTS "characters";
