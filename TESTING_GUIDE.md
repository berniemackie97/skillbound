# Testing Guide

## Current Status

✅ **Database** - Schemas created, migrations generated
✅ **Hiscores API** - Client with caching and proper boss names
✅ **Character Lookup** - API endpoint with validation
✅ **XP Calculations** - Domain logic with full test coverage

## Quick Test Workflow

### 1. Install Dependencies

```bash
cd /Volumes/EnderChest/Development/Repos/Web/osrs/skillbound
pnpm install
```

### 2. Start the Development Server

```bash
pnpm --filter @skillbound/web dev
```

This starts Next.js on `http://localhost:3000`

### 3. Test the Character Lookup API

Open your browser or use curl to test the API:

**Browser:**
- `http://localhost:3000/api/characters/lookup?username=Lynx Titan&mode=normal`
- `http://localhost:3000/api/characters/lookup?username=Settled&mode=ironman`

**Terminal:**

```bash
# Test with a famous player
curl "http://localhost:3000/api/characters/lookup?username=Lynx%20Titan&mode=normal" | jq

# Test with ironman mode
curl "http://localhost:3000/api/characters/lookup?username=Settled&mode=ironman" | jq

# Test error handling
curl "http://localhost:3000/api/characters/lookup?username=PlayerDoesNotExist12345" | jq
```

### 4. Verify Boss Names

The response should now have proper boss names instead of `activity_0`, `activity_1`, etc:

```json
{
  "success": true,
  "data": {
    "username": "Lynx Titan",
    "mode": "normal",
    "skills": {
      "overall": { "rank": 1, "level": 2277, "xp": 4600000000 },
      "attack": { "rank": 1, "level": 99, "xp": 200000000 }
      // ... more skills
    },
    "activities": {
      "zulrah": { "rank": 123456, "score": 1500 },
      "vorkath": { "rank": 234567, "score": 2000 },
      "chambers_of_xeric": { "rank": 45678, "score": 100 }
      // ... proper boss names!
    }
  }
}
```

### 5. Run All CI Checks

```bash
# Type checking
pnpm typecheck

# Linting
pnpm lint

# Formatting
pnpm format:check

# All at once
pnpm typecheck && pnpm lint && pnpm format:check
```

## What to Test

### ✅ Working Now

1. **Character Lookup API**
   - Valid OSRS usernames return data
   - Boss names are descriptive (not activity_0)
   - Skills show correct levels and XP
   - Invalid usernames return 404
   - Proper error messages

2. **Code Quality**
   - TypeScript compiles without errors
   - ESLint passes with no warnings
   - Code is properly formatted

3. **XP Calculations** (from domain package)
   - Run tests: `pnpm --filter @skillbound/domain test`

### 🚧 Not Yet Implemented

These require database setup (Docker) which you'll need to install:

1. **Database Operations**
   - Saving characters
   - Creating snapshots
   - Tracking progress

2. **Authentication**
   - Google OAuth login
   - User sessions

3. **UI Pages**
   - Character dashboard
   - Progress graphs
   - Guide tracking

## Next Steps for Full Testing

### Install Docker (if not already installed)

**macOS:**
```bash
brew install --cask docker
```

Or download from: https://www.docker.com/products/docker-desktop/

### Start Database and Test Full Stack

```bash
# Start database
docker compose up -d

# Push schema
pnpm db:push

# Open database browser
pnpm db:studio
```

Then you'll be able to test:
- Saving tracked characters
- Creating progress snapshots
- User authentication flows

## Expected Test Results

### ✅ Success Indicators

- API returns JSON with proper structure
- Boss names are readable (e.g., "vorkath", "zulrah")
- Skills have level and XP values
- TypeScript compilation succeeds
- Linting passes
- No console errors in browser

### ❌ Common Issues

**"Cannot find module"**
- Run `pnpm install` again

**"Port 3000 already in use"**
- Kill the process: `lsof -ti:3000 | xargs kill -9`

**"Network request failed"**
- OSRS hiscores might be down
- Try a different username
- Check internet connection

## Feedback Loop

After testing, please provide feedback on:

1. **Functionality**: Does the API work as expected?
2. **Data Quality**: Are boss names correct and readable?
3. **Performance**: How fast are responses?
4. **Errors**: Any error messages or bugs?
5. **UX**: What features would you like to see next?

This helps prioritize the next implementation steps!
