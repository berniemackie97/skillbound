ALTER TABLE "user_settings"
  ADD COLUMN "ge_refresh_interval_ms" integer NOT NULL DEFAULT 45000,
  ADD COLUMN "ge_refresh_paused" boolean NOT NULL DEFAULT false;
