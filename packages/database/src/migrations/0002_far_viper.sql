ALTER TABLE "sessions" DROP CONSTRAINT "sessions_session_token_unique";--> statement-breakpoint
ALTER TABLE "sessions" DROP CONSTRAINT IF EXISTS "sessions_pkey";--> statement-breakpoint
ALTER TABLE "accounts" DROP CONSTRAINT IF EXISTS "accounts_pkey";--> statement-breakpoint
ALTER TABLE "accounts" ALTER COLUMN "expires_at" SET DATA TYPE integer USING EXTRACT(EPOCH FROM "expires_at")::integer;--> statement-breakpoint
ALTER TABLE "sessions" ADD PRIMARY KEY ("session_token");--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_provider_provider_account_id_pk" PRIMARY KEY("provider","provider_account_id");--> statement-breakpoint
ALTER TABLE "accounts" DROP COLUMN IF EXISTS "id";--> statement-breakpoint
ALTER TABLE "sessions" DROP COLUMN IF EXISTS "id";
