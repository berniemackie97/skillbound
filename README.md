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
- **Tailwind CSS** for styling
- **Prisma** as ORM

### Infrastructure
- **Vercel** for hosting
- **Neon** for PostgreSQL database
- **Upstash Redis** for caching and rate limiting
- **Inngest** for background jobs and workflows
- **Auth.js** for authentication

### Observability
- **Sentry** for error tracking
- **Structured logging** with correlation IDs

## Architecture

Skillbound follows a modular monolith architecture with strict boundaries:

```
/apps
  /web              Next.js application
/packages
  /domain           Pure business logic (no framework dependencies)
  /database         Prisma schema and migrations
  /integrations     External API clients (hiscores, wiki)
  /content          Content bundle schemas and validators
  /ui               Shared UI primitives
  /testing          Test utilities and fixtures
/tooling
  /typescript       Shared TypeScript configurations
  /eslint           ESLint configurations
  /prettier         Prettier configuration
```

### Design Principles

1. **Domain-first**: Core business logic lives in `/packages/domain` with zero framework dependencies
2. **Type safety**: End-to-end type safety with no `any` types
3. **Testability**: 80%+ code coverage with unit, integration, and e2e tests
4. **Validation everywhere**: Zod schemas for all inputs/outputs
5. **Isolated integrations**: All external API calls isolated with caching, timeouts, and retries

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 8+
- PostgreSQL (via Neon or local)
- Redis (via Upstash or local)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/skillbound.git
cd skillbound

# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env.local

# Set up database
pnpm db:migrate
pnpm db:generate

# Start development server
pnpm dev
```

The app will be available at http://localhost:3000

### Environment Variables

See `.env.example` for required environment variables:

- `DATABASE_URL`: Neon PostgreSQL connection string
- `REDIS_URL`: Upstash Redis connection string
- `NEXTAUTH_SECRET`: Auth.js secret
- `NEXTAUTH_URL`: Application URL
- `GOOGLE_CLIENT_ID`: Google OAuth client ID
- `GOOGLE_CLIENT_SECRET`: Google OAuth client secret

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
pnpm db:migrate       # Run migrations
pnpm db:studio        # Open Prisma Studio
pnpm db:generate      # Generate Prisma Client
pnpm db:push          # Push schema to database (dev only)
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

Prisma schema and repository implementations:

- User accounts and sessions
- Characters and snapshots
- Overrides and preferences
- Content bundles
- Guide templates and progress

### Integrations (`/packages/integrations`)

External API clients with proper error handling:

- **HiscoresClient**: Fetches OSRS hiscores data
- **WikiClient**: Accesses OSRS Wiki API
- **ThirdPartyClient**: Optional WiseOldMan/Temple integration

All clients implement:
- Timeout and AbortSignal support
- Exponential backoff retries
- Circuit breaker pattern
- Redis caching

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

Migrations run automatically on deployment via Prisma:

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
