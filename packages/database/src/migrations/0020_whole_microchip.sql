ALTER TABLE "ge_flip_suggestions" ADD COLUMN "flip_quality_grade" text;--> statement-breakpoint
ALTER TABLE "ge_flip_suggestions" ADD COLUMN "flip_quality_score" integer;--> statement-breakpoint
ALTER TABLE "ge_flip_suggestions" ADD COLUMN "quality_liquidity" integer;--> statement-breakpoint
ALTER TABLE "ge_flip_suggestions" ADD COLUMN "quality_staleness" integer;--> statement-breakpoint
ALTER TABLE "ge_flip_suggestions" ADD COLUMN "quality_margin_stability" integer;--> statement-breakpoint
ALTER TABLE "ge_flip_suggestions" ADD COLUMN "quality_volume_adequacy" integer;--> statement-breakpoint
ALTER TABLE "ge_flip_suggestions" ADD COLUMN "quality_buy_pressure" integer;--> statement-breakpoint
ALTER TABLE "ge_flip_suggestions" ADD COLUMN "quality_tax_efficiency" integer;--> statement-breakpoint
ALTER TABLE "ge_flip_suggestions" ADD COLUMN "quality_flags" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
CREATE INDEX "ge_flip_quality_grade_idx" ON "ge_flip_suggestions" USING btree ("flip_quality_grade");--> statement-breakpoint
CREATE INDEX "ge_flip_quality_score_idx" ON "ge_flip_suggestions" USING btree ("flip_quality_score");