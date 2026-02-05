# Vercel Beta Deployment (Skillbound)

This guide prepares the app for a public beta on Vercel using Vercel Postgres.

## 1) Create the Vercel project

1. Create a new Vercel project named **skillbound**.
2. Set **Root Directory** to `apps/web`.
3. Framework should auto-detect as **Next.js**.

## 2) Provision the production database

1. In the Vercel project, add **Vercel Postgres**.
2. Copy the connection string into `DATABASE_URL`.
3. Use the non-pooled connection string for migrations when running locally.

## 3) Configure required environment variables

Set these in Vercel (Production + Preview):

Required:

- `DATABASE_URL`
- `NEXTAUTH_URL` (set after Vercel provides the domain)
- `AUTH_SECRET` (generate: `openssl rand -base64 32`)
- `CRON_SECRET` (generate: `openssl rand -base64 32`)

Recommended:

- `SKILLBOUND_USER_AGENT` (example: `Skillbound/1.0 (contact@skillbound.gg)`)
- `INTEGRATIONS_USER_AGENT` (optional)

Optional (performance / rate limiting):

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

Optional (content bundle hosting):

- `CONTENT_BUNDLE_URL` (if you want to serve bundles from external storage)

Optional (snapshot cold storage):

- `SNAPSHOT_ARCHIVE_BUCKET`
- `SNAPSHOT_ARCHIVE_REGION` (use `auto` for R2)
- `SNAPSHOT_ARCHIVE_ENDPOINT` (R2/MinIO endpoint if not AWS)
- `SNAPSHOT_ARCHIVE_ACCESS_KEY_ID`
- `SNAPSHOT_ARCHIVE_SECRET_ACCESS_KEY`
- `SNAPSHOT_ARCHIVE_PREFIX` (default: `snapshot-archives`)
- `SNAPSHOT_ARCHIVE_PUBLIC_BASE_URL` (optional public base URL for downloads)
- `SNAPSHOT_ARCHIVE_FORCE_PATH_STYLE` (`true` for R2/MinIO)
- `SNAPSHOT_ARCHIVE_ALLOW_DELETE` (set to `true` only after verifying archives)

## 4) Run migrations against production DB

From your machine (with `DATABASE_URL` pointing to production):

```
pnpm db:migrate
pnpm db:seed:progression
```

## 5) Cron jobs (already configured)

`apps/web/vercel.json` defines cron schedules:

- Snapshots daily at 02:00 UTC (minAgeHours=24)
- Retention weekly at 03:30 UTC (Sunday)
- Content sync weekly (Sunday 04:00 UTC)

Vercel automatically includes the `Authorization: Bearer $CRON_SECRET` header
for Cron Jobs when `CRON_SECRET` is set, which the cron endpoints accept.

If you want to disable a job, remove it from `apps/web/vercel.json`.

## 6) Content bundle notes

The content sync cron runs server-side and attempts to write `public/content`.
On Vercel, filesystem writes can fail. The cron endpoint will still sync data
and store bundle metadata. If you want to serve bundles from a stable URL,
set `CONTENT_BUNDLE_URL` to an external file (S3/R2/etc.).

## 7) Snapshot retention + cold storage

Retention promotes snapshots into tiers (hourly/daily/weekly/monthly). Deletions
are **blocked** unless snapshot archiving is configured and
`SNAPSHOT_ARCHIVE_ALLOW_DELETE=true`. This ensures no data loss until you verify
archiving is working. Archives are stored in object storage and can be restored
via the admin endpoints.

## 8) Deploy

1. Push to main.
2. Trigger a production deploy from Vercel.
3. After deploy, set `NEXTAUTH_URL` to the production domain.

## 9) Health check endpoints (optional)

Use these to verify cron health:

- `/api/cron/snapshots`
- `/api/cron/retention`
- `/api/cron/content`

All require `CRON_SECRET` via the `Authorization` header.

Snapshot archive admin endpoints (also `CRON_SECRET` protected):

- `GET /api/admin/snapshots/archives`
- `GET /api/admin/snapshots/archives/{id}?download=true`
- `POST /api/admin/snapshots/archives/{id}/restore?dryRun=true`
