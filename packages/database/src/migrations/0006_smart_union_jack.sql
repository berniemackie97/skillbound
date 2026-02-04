CREATE TABLE IF NOT EXISTS "combat_achievement_definitions" (
	"id" text PRIMARY KEY NOT NULL,
	"runelite_id" integer,
	"name" text NOT NULL,
	"tier" text,
	"requirements" jsonb DEFAULT '[]'::jsonb,
	"optional_requirements" jsonb,
	"wiki_url" text,
	"wiki_revision_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "combat_achievement_definitions_runelite_id_unique" UNIQUE("runelite_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "content_sync_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_type" text NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"records_synced" integer DEFAULT 0,
	"error_message" text,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "diary_definitions" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"region" text NOT NULL,
	"wiki_url" text,
	"wiki_revision_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "diary_task_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tier_id" uuid NOT NULL,
	"task_id" text NOT NULL,
	"task_order" integer NOT NULL,
	"description" text NOT NULL,
	"requirements" jsonb DEFAULT '[]'::jsonb,
	"optional_requirements" jsonb,
	"wiki_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "diary_task_defs_tier_order_unique" UNIQUE("tier_id","task_order")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "diary_tier_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"diary_id" text NOT NULL,
	"tier" text NOT NULL,
	"name" text,
	"requirements" jsonb DEFAULT '[]'::jsonb,
	"optional_requirements" jsonb,
	"wiki_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "diary_tier_defs_diary_tier_unique" UNIQUE("diary_id","tier")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "quest_definitions" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"requirements" jsonb DEFAULT '[]'::jsonb,
	"optional_requirements" jsonb,
	"wiki_url" text,
	"wiki_revision_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "diary_task_definitions" ADD CONSTRAINT "diary_task_definitions_tier_id_diary_tier_definitions_id_fk" FOREIGN KEY ("tier_id") REFERENCES "public"."diary_tier_definitions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "diary_tier_definitions" ADD CONSTRAINT "diary_tier_definitions_diary_id_diary_definitions_id_fk" FOREIGN KEY ("diary_id") REFERENCES "public"."diary_definitions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "combat_achievement_defs_runelite_id_idx" ON "combat_achievement_definitions" USING btree ("runelite_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "combat_achievement_defs_updated_at_idx" ON "combat_achievement_definitions" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "content_sync_jobs_content_type_idx" ON "content_sync_jobs" USING btree ("content_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "content_sync_jobs_status_idx" ON "content_sync_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "content_sync_jobs_started_at_idx" ON "content_sync_jobs" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "diary_defs_updated_at_idx" ON "diary_definitions" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "diary_task_defs_tier_id_idx" ON "diary_task_definitions" USING btree ("tier_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "diary_tier_defs_diary_id_idx" ON "diary_tier_definitions" USING btree ("diary_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "quest_defs_updated_at_idx" ON "quest_definitions" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "quest_defs_wiki_revision_idx" ON "quest_definitions" USING btree ("wiki_revision_id");