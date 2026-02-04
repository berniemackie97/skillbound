ALTER TABLE "characters"
ADD COLUMN IF NOT EXISTS "wom_backfill_checked_at" timestamp with time zone;
