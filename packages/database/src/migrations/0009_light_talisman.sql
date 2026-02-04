CREATE TYPE "public"."difficulty_tier" AS ENUM('easy', 'medium', 'hard', 'elite', 'master');--> statement-breakpoint
CREATE TYPE "public"."game_stage" AS ENUM('early', 'mid', 'late', 'end', 'specialized');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "boss_killcounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"character_id" uuid NOT NULL,
	"boss_name" text NOT NULL,
	"killcount" integer DEFAULT 0 NOT NULL,
	"personal_best" integer,
	"last_updated" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "collection_log_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"character_id" uuid NOT NULL,
	"category_id" uuid,
	"item_name" text NOT NULL,
	"item_id" integer,
	"source" text NOT NULL,
	"obtained" boolean DEFAULT false NOT NULL,
	"obtained_at" timestamp with time zone,
	"droprate" text,
	"killcount_when_obtained" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "gear_progression" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"character_id" uuid NOT NULL,
	"game_stage" "game_stage" NOT NULL,
	"slot" text NOT NULL,
	"item_name" text NOT NULL,
	"item_id" integer,
	"obtained" boolean DEFAULT false NOT NULL,
	"obtained_at" timestamp with time zone,
	"source" text,
	"priority" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"order_index" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "milestones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"character_id" uuid NOT NULL,
	"category_id" uuid,
	"difficulty" "difficulty_tier" NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"requirements" jsonb,
	"achieved" boolean DEFAULT false NOT NULL,
	"achieved_at" timestamp with time zone,
	"notes" text,
	"order_index" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ge_trades" DROP CONSTRAINT "ge_trades_matched_trade_id_ge_trades_id_fk";
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "boss_killcounts" ADD CONSTRAINT "boss_killcounts_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "collection_log_items" ADD CONSTRAINT "collection_log_items_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "collection_log_items" ADD CONSTRAINT "collection_log_items_category_id_progression_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."progression_categories"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "gear_progression" ADD CONSTRAINT "gear_progression_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "milestones" ADD CONSTRAINT "milestones_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "milestones" ADD CONSTRAINT "milestones_category_id_progression_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."progression_categories"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "boss_kc_character_id_idx" ON "boss_killcounts" USING btree ("character_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "boss_kc_character_boss_idx" ON "boss_killcounts" USING btree ("character_id","boss_name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "coll_log_character_id_idx" ON "collection_log_items" USING btree ("character_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "coll_log_character_source_idx" ON "collection_log_items" USING btree ("character_id","source");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "coll_log_character_obtained_idx" ON "collection_log_items" USING btree ("character_id","obtained");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gear_prog_character_id_idx" ON "gear_progression" USING btree ("character_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gear_prog_character_stage_idx" ON "gear_progression" USING btree ("character_id","game_stage");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "milestones_character_id_idx" ON "milestones" USING btree ("character_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "milestones_character_difficulty_idx" ON "milestones" USING btree ("character_id","difficulty");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "milestones_character_achieved_idx" ON "milestones" USING btree ("character_id","achieved");