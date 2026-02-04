ALTER TABLE "user_characters"
ADD COLUMN IF NOT EXISTS "archived_at" timestamp with time zone;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_characters_archived_at_idx" ON "user_characters" USING btree ("archived_at");
--> statement-breakpoint

ALTER TABLE "user_settings"
ADD COLUMN IF NOT EXISTS "character_sync_enabled" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE "user_settings"
ADD COLUMN IF NOT EXISTS "character_sync_interval_hours" integer DEFAULT 24 NOT NULL;
