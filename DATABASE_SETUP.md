# Database Setup Guide

## Prerequisites

You need Docker installed. If you don't have it:
- Download from: https://www.docker.com/products/docker-desktop/
- Or install via Homebrew: `brew install --cask docker`

## Quick Start

### 1. Start the Database

```bash
docker compose up -d
```

This starts PostgreSQL on `localhost:5432` with:
- Username: `skillbound`
- Password: `skillbound`
- Database: `skillbound_dev`

### 2. Set Up Environment Variables

```bash
cp .env.example .env
```

The `.env` file is already configured with the correct connection string.

### 3. Run Migrations

```bash
pnpm db:push
```

Or if you prefer migrations:

```bash
pnpm db:migrate
```

### 4. (Optional) Open Drizzle Studio

```bash
pnpm db:studio
```

This opens a visual database browser at `https://local.drizzle.studio`

## Database Commands

All commands should be run from the project root:

```bash
# Generate new migration after schema changes
pnpm db:generate

# Push schema changes directly (development)
pnpm db:push

# Run pending migrations
pnpm db:migrate

# Open Drizzle Studio
pnpm db:studio

# Stop the database
docker compose down

# Stop and remove all data (fresh start)
docker compose down -v
```

## Connection String

The database is accessible at:

```
postgresql://skillbound:skillbound@localhost:5432/skillbound_dev
```

## Troubleshooting

### Port 5432 Already in Use

If you have another PostgreSQL instance running:

```bash
# Stop other PostgreSQL services
brew services stop postgresql

# Or change the port in docker-compose.yml
ports:
  - '5433:5432'  # Use port 5433 instead
```

### Permission Denied

Make sure Docker Desktop is running if you're on macOS.

### Cannot Connect

Check if the container is healthy:

```bash
docker compose ps
docker compose logs postgres
```
