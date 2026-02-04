# Skillbound

> Enterprise-quality Old School RuneScape character tracking and progression platform

Skillbound is a comprehensive web platform that imports OSRS character data from hiscores and third-party trackers, merges it with structured knowledge from the OSRS Wiki, and provides completion tracking, calculators, recommendations, comparison dashboards, admin-curated progression guides, and long-term progress graphs.

## Features

- **Multi-character management**: Track multiple accounts (main, iron, UIM, HC)
- **Accurate calculators**: XP/level, action-based, time-to-goal
- **Completion tracking**: Quests, diaries, combat achievements, clues
- **Admin-curated guides**: Step-by-step progression paths with requirement validation
- **Progress snapshots**: Long-term tracking with visual graphs
- **Recommendations**: Explainable, rule-based suggestions
- **Anonymous mode**: Use calculators and lookup without an account

## Tech Stack

### Core

- **Next.js 14+** with App Router (React Server Components)
- **TypeScript 5+** with strict mode
- **Drizzle ORM** for type-safe database queries and migrations
- **Tailwind CSS** for styling (planned)

### Infrastructure

- **PostgreSQL 15** for database
- **Docker** for local development
- **Vercel** for hosting (planned)
- **Auth.js** for authentication (planned)
- **Inngest** for background jobs (planned)
- **Upstash Redis + Rate Limit** for caching and throttling (optional but recommended)

### Implemented Features

✅ **Database Layer** - Complete Drizzle schemas for all entities
✅ **Hiscores API Client** - Retry logic, caching, JSON parsing
✅ **Health Endpoint** - `/api/health`
✅ **Character Lookup API** - Request validation with Zod
✅ **Domain Logic** - XP calculations with full test coverage

### In Progress

🚧 **Character Management UI** - Track and manage characters
🚧 **Snapshot System** - Historical progress tracking
🚧 **Requirements Engine** - Quest/diary completion checking

## Architecture

Skillbound follows a modular monolith architecture with strict boundaries:

```
/apps
  /web              Next.js 14 application with App Router
/packages
  /domain           Pure business logic with XP calculations
  /database         Drizzle ORM schemas and migrations
  /hiscores         OSRS Hiscores API client with caching
  /wiki-api         OSRS Wiki API clients (bucket + prices)
  /integrations     Third-party data sources (Wise Old Man, TempleOSRS, OSRSBox, RuneLite exports)
  /content          Content bundle schemas + seed data for quests/diaries
/tooling
  /typescript       Shared TypeScript configurations
  /eslint           Shared ESLint configurations
  /prettier         Shared Prettier configuration
```

### Design Principles

1. **Domain-first**: Core business logic lives in `/packages/domain` with zero framework dependencies
2. **Type safety**: End-to-end type safety with no `any` types
3. **Testability**: 80%+ code coverage with unit, integration, and e2e tests
4. **Validation everywhere**: Zod schemas for all inputs/outputs
5. **Isolated integrations**: All external API calls isolated with caching, timeouts, and retries

## Getting Started

### Prerequisites

- **Node.js 20+** and **pnpm 8+**
- **Docker** (for local PostgreSQL database)

### Quick Start

```bash
# 1. Install dependencies
pnpm install

# 2. Copy environment variables
cp .env.example .env

# 3. Start PostgreSQL database
docker compose up -d

# 4. Push database schema
pnpm db:push

# 5. Start development server
pnpm --filter @skillbound/web dev
```

The app will be available at **http://localhost:3000**

### Test the API

```bash
# Test character lookup (replace with any OSRS player name)
curl "http://localhost:3000/api/characters/lookup?username=Lynx%20Titan&mode=auto"

# Wise Old Man lookup
curl "http://localhost:3000/api/integrations/wise-old-man?username=Lynx%20Titan"

# TempleOSRS lookup (info + stats)
curl "http://localhost:3000/api/integrations/temple?username=Lynx%20Titan&include=info,stats"

# OSRSBox item lookup
curl "http://localhost:3000/api/integrations/osrsbox/items?ids=4151,11840"

# Collection log lookup (collectionlog.net)
curl "http://localhost:3000/api/integrations/collectionlog?username=Lynx%20Titan"

# GE price endpoints (OSRS Wiki real-time prices)
curl "http://localhost:3000/api/ge/prices/latest?id=4151"
curl "http://localhost:3000/api/ge/prices/5m"
curl "http://localhost:3000/api/ge/prices/1h"
curl "http://localhost:3000/api/ge/prices/timeseries?id=4151&timestep=5m"
curl "http://localhost:3000/api/ge/mapping?id=4151"

# Content bundles
curl "http://localhost:3000/api/content/latest"
curl "http://localhost:3000/api/content/quests"
curl "http://localhost:3000/api/content/diaries"
curl "http://localhost:3000/api/content/combat-achievements"

# Calculators
curl -X POST "http://localhost:3000/api/calculators/xp" \\
  -H "Content-Type: application/json" \\
  -d '{"currentLevel":1,"targetLevel":5}'

curl -X POST "http://localhost:3000/api/calculators/action-plan" \\
  -H "Content-Type: application/json" \\
  -d '{"currentLevel":1,"actions":[{"name":"Burn logs","xpPerAction":40,"actionsCompleted":10}]}'

# Character management (requires DB)
curl -X POST "http://localhost:3000/api/characters" \\
  -H "Content-Type: application/json" \\
  -d '{"displayName":"Lynx Titan","mode":"auto"}'

# List/search characters (public only)
curl "http://localhost:3000/api/characters?search=Lynx&includeSnapshots=true"

# Compare two characters (requires DB)
curl "http://localhost:3000/api/compare?characterIds=<id1>,<id2>"

# Snapshot range summary (requires DB)
curl "http://localhost:3000/api/characters/<id>/snapshots/summary?from=2025-01-01T00:00:00.000Z&to=2025-12-31T23:59:59.000Z"

# Combat achievement requirements (requires DB + hiscores)
curl "http://localhost:3000/api/characters/<id>/requirements/combat-achievements"

# Snapshot gains + per-day rates (requires DB)
curl "http://localhost:3000/api/characters/<id>/snapshots/gains?from=2025-01-01T00:00:00.000Z&to=2025-12-31T23:59:59.000Z"

# Snapshot series for graphs (requires DB)
curl "http://localhost:3000/api/characters/<id>/snapshots/series?from=2025-01-01T00:00:00.000Z&to=2025-12-31T23:59:59.000Z&bucket=week"

# Skill timeseries for graphs (requires DB)
curl "http://localhost:3000/api/characters/<id>/snapshots/skills-series?from=2025-01-01T00:00:00.000Z&to=2025-12-31T23:59:59.000Z&bucket=month&skills=attack,strength"

# Scheduled snapshot capture (cron-style, requires CRON_SECRET)
curl -X POST "http://localhost:3000/api/admin/snapshots/capture?minAgeHours=24&limit=50" \\
  -H "x-skillbound-cron-secret: $CRON_SECRET"

# Dry-run snapshot capture (lists candidates + skipped)
curl -X POST "http://localhost:3000/api/admin/snapshots/capture?dryRun=true&minAgeHours=24" \\
  -H "x-skillbound-cron-secret: $CRON_SECRET"
```

You should see JSON with all skills and boss kill counts!

### Database Management

See [DATABASE_SETUP.md](./DATABASE_SETUP.md) for detailed database instructions.

```bash
pnpm db:generate  # Generate new migration after schema changes
pnpm db:push      # Push schema changes directly (development)
pnpm db:studio    # Open visual database browser
```

## Development

### Commands

```bash
# Development
pnpm dev              # Start all apps in dev mode
pnpm build            # Build all apps and packages
pnpm lint             # Lint all code
pnpm typecheck        # Type check all code
pnpm format           # Format all code
pnpm format:check     # Check code formatting

# Testing
pnpm test             # Run all tests
pnpm test:unit        # Run unit tests
pnpm test:integration # Run integration tests
pnpm test:e2e         # Run e2e tests

# Database
pnpm db:generate      # Generate migrations from schema
pnpm db:push          # Push schema to database (dev)
pnpm db:migrate       # Run pending migrations (production)
pnpm db:studio        # Open Drizzle Studio
```

### Testing Strategy

- **Unit tests** (Vitest): Pure functions, calculators, domain logic
- **Integration tests** (Vitest): API routes, database operations
- **E2E tests** (Playwright): Complete user workflows

All tests run automatically in CI on every PR.

### Code Quality

- **TypeScript strict mode** enforced
- **ESLint** with strict rules
- **Prettier** for consistent formatting
- **Husky + lint-staged** for pre-commit hooks
- **GitHub Actions** for CI/CD

## Project Structure

### Domain Layer (`/packages/domain`)

Pure business logic with no external dependencies:

- XP table and level calculations
- Requirements engine (skills, quests, diaries)
- Recommendation rules
- Calculator logic

### Database Layer (`/packages/database`)

Drizzle schema and migrations:

- User accounts and sessions
- Characters and snapshots
- Overrides and preferences
- Content bundles
- Guide templates and progress

### Integrations (`/packages/hiscores`, `/packages/wiki-api`, `/packages/integrations`)

External API clients with proper error handling:

- **HiscoresClient**: Fetches OSRS hiscores data (JSON endpoint)
- **WikiBucketClient**: Structured game data from OSRS Wiki bucket API
- **WikiPricesClient**: Real-time prices + item mapping
- **WiseOldManClient**: Optional progress and EHP/EHB data
- **TempleOSRSClient**: Optional player stats/gains/time-series data
- **OsrsBoxClient**: Item/monster datasets for calculators and requirements
- **RuneLiteExports**: Parsers for bank tag and collection log exports
- **CollectionLogClient**: Collection log data (collectionlog.net)

All clients implement:

- Timeout and AbortSignal support
- Exponential backoff retries
- Required User-Agent headers where applicable

### Content Pipeline

Wiki-powered knowledge is processed offline:

1. **Ingest**: Fetch raw data from OSRS Wiki API
2. **Transform**: Normalize into canonical JSON
3. **Validate**: Check schemas and invariants
4. **Publish**: Upload bundle to object storage
5. **Serve**: API returns latest published version

Content bundles are versioned and immutable.

## Deployment

### Automatic Deployments

- **Preview deployments**: Created for every PR
- **Production deployments**: Automatic on merge to `main`

### Manual Deployment

```bash
# Deploy to preview
vercel

# Deploy to production
vercel --prod
```

### Database Migrations

Migrations run automatically on deployment via Drizzle:

```bash
pnpm db:migrate
```

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development guidelines.

### Pull Request Process

1. Create a feature branch from `main`
2. Make your changes with tests
3. Ensure all CI checks pass
4. Request review from maintainers
5. Squash and merge after approval

## License

MIT License - see [LICENSE](./LICENSE) for details

## Support

- **Issues**: https://github.com/your-org/skillbound/issues
- **Discussions**: https://github.com/your-org/skillbound/discussions
- **Wiki**: https://github.com/your-org/skillbound/wiki
