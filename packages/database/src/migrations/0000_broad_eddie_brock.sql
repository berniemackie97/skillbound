CREATE TYPE "public"."account_mode" AS ENUM('normal', 'ironman', 'hardcore-ironman', 'ultimate-ironman');--> statement-breakpoint
CREATE TYPE "public"."override_type" AS ENUM('quest_complete', 'diary_complete', 'diary_task_complete', 'unlock_flag', 'item_possessed', 'combat_achievement');--> statement-breakpoint
CREATE TYPE "public"."bundle_status" AS ENUM('draft', 'published', 'deprecated');--> statement-breakpoint
CREATE TYPE "public"."guide_status" AS ENUM('draft', 'published', 'deprecated');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"email_verified" timestamp with time zone,
	"name" text,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" timestamp with time zone,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_token" text NOT NULL,
	"user_id" uuid NOT NULL,
	"expires" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_session_token_unique" UNIQUE("session_token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "characters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"display_name" text NOT NULL,
	"mode" "account_mode" DEFAULT 'normal' NOT NULL,
	"last_synced_at" timestamp with time zone,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"notes" text,
	"is_public" text DEFAULT 'false' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "character_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"character_id" uuid NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"total_level" integer NOT NULL,
	"total_xp" bigint NOT NULL,
	"combat_level" integer NOT NULL,
	"skills" jsonb NOT NULL,
	"activities" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "character_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"character_id" uuid NOT NULL,
	"type" "override_type" NOT NULL,
	"key" text NOT NULL,
	"value" jsonb NOT NULL,
	"note" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "content_bundles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" text NOT NULL,
	"status" "bundle_status" DEFAULT 'draft' NOT NULL,
	"checksum" text NOT NULL,
	"storage_uri" text NOT NULL,
	"metadata" jsonb,
	"published_at" timestamp with time zone,
	"deprecated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "content_bundles_version_unique" UNIQUE("version")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "guide_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"character_id" uuid NOT NULL,
	"guide_template_id" uuid NOT NULL,
	"guide_version" integer NOT NULL,
	"completed_steps" jsonb DEFAULT '[]'::jsonb,
	"current_step" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "guide_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"status" "guide_status" DEFAULT 'draft' NOT NULL,
	"recommended_modes" jsonb DEFAULT '["normal"]'::jsonb,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"steps" jsonb NOT NULL,
	"published_at" timestamp with time zone,
	"deprecated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "characters" ADD CONSTRAINT "characters_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "character_snapshots" ADD CONSTRAINT "character_snapshots_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "character_overrides" ADD CONSTRAINT "character_overrides_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "guide_progress" ADD CONSTRAINT "guide_progress_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "guide_progress" ADD CONSTRAINT "guide_progress_guide_template_id_guide_templates_id_fk" FOREIGN KEY ("guide_template_id") REFERENCES "public"."guide_templates"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "characters_user_id_idx" ON "characters" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "characters_display_name_idx" ON "characters" USING btree ("display_name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "snapshots_character_id_idx" ON "character_snapshots" USING btree ("character_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "snapshots_captured_at_idx" ON "character_snapshots" USING btree ("captured_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "snapshots_character_captured_idx" ON "character_snapshots" USING btree ("character_id","captured_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "overrides_character_id_idx" ON "character_overrides" USING btree ("character_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "overrides_type_key_idx" ON "character_overrides" USING btree ("type","key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "overrides_character_type_key_idx" ON "character_overrides" USING btree ("character_id","type","key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bundles_status_idx" ON "content_bundles" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bundles_published_at_idx" ON "content_bundles" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "guide_progress_character_id_idx" ON "guide_progress" USING btree ("character_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "guide_progress_guide_template_id_idx" ON "guide_progress" USING btree ("guide_template_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "guide_templates_status_idx" ON "guide_templates" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "guide_templates_published_at_idx" ON "guide_templates" USING btree ("published_at");