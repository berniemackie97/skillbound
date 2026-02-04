ALTER TABLE "character_snapshots" ADD COLUMN "data_source" text DEFAULT 'hiscores' NOT NULL;--> statement-breakpoint
ALTER TABLE "character_snapshots" ADD COLUMN "data_source_warning" text;--> statement-breakpoint
ALTER TABLE "character_snapshots" ADD COLUMN "quests" jsonb;--> statement-breakpoint
ALTER TABLE "character_snapshots" ADD COLUMN "achievement_diaries" jsonb;--> statement-breakpoint
ALTER TABLE "character_snapshots" ADD COLUMN "music_tracks" jsonb;--> statement-breakpoint
ALTER TABLE "character_snapshots" ADD COLUMN "combat_achievements" jsonb;--> statement-breakpoint
ALTER TABLE "character_snapshots" ADD COLUMN "collection_log" jsonb;--> statement-breakpoint
ALTER TABLE "public"."characters" ALTER COLUMN "mode" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "public"."characters" ALTER COLUMN "mode" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."account_mode" CASCADE;--> statement-breakpoint
CREATE TYPE "public"."account_mode" AS ENUM('normal', 'ironman', 'hardcore', 'ultimate', 'group-ironman', 'hardcore-group-ironman', 'unranked-group-ironman');--> statement-breakpoint
ALTER TABLE "public"."characters" ALTER COLUMN "mode" SET DATA TYPE "public"."account_mode" USING "mode"::"public"."account_mode";--> statement-breakpoint
ALTER TABLE "public"."characters" ALTER COLUMN "mode" SET DEFAULT 'normal';--> statement-breakpoint