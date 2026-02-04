CREATE TABLE IF NOT EXISTS "snapshot_archives" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "profile_id" uuid NOT NULL REFERENCES "public"."character_profiles"("id") ON DELETE cascade,
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
  "compressed" boolean NOT NULL DEFAULT true,
  "archive_version" integer NOT NULL DEFAULT 1,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "snapshot_archives_profile_source_reason_bucket_unique" ON "snapshot_archives" USING btree ("profile_id","source_tier","reason","bucket_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "snapshot_archives_profile_idx" ON "snapshot_archives" USING btree ("profile_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "snapshot_archives_source_tier_idx" ON "snapshot_archives" USING btree ("source_tier");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "snapshot_archives_bucket_idx" ON "snapshot_archives" USING btree ("bucket_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "snapshot_archives_created_at_idx" ON "snapshot_archives" USING btree ("created_at");
