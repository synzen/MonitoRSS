# E2E Testing with Playwright

This directory contains end-to-end tests for the backend-api-next service using Playwright.

## Prerequisites

1. Docker stack must be running with the `next` profile:

   ```bash
   docker compose -f docker-compose.dev.yml --profile next up
   ```

2. You must have authenticated via Discord (see Setup below)

## Setup (One-time)

Before running tests, you need to capture a Discord OAuth session:

```bash
npm run e2e:auth
```

This opens a browser where you log in via Discord. After logging in:

1. Navigate to any page to confirm you're authenticated
2. Close the browser

Your session is saved to `e2e/auth.json` (gitignored).

## Running Tests

```bash
# Run all tests
npm run e2e

# Run tests with UI
npm run e2e:ui

# View test report
npm run e2e:report
```

## Connection Tests (One-time Setup)

Tests that use the `testFeedWithConnection` fixture require a Discord channel ID where the bot has permissions.

Create `e2e/config.json` with your channel ID:

```json
{
  "channelId": "123456789012345678"
}
```

To find a channel ID: Right-click a channel in Discord (with Developer Mode enabled) and select "Copy ID".

This file is gitignored and only needs to be set up once.

## When Session Expires

If tests fail with "Session expired!" message:

```bash
npm run e2e:auth
```

Log in again via Discord (~30 seconds), then re-run tests.

## Test Structure

- `e2e/tests/auth.spec.ts` - Authentication verification
- `e2e/tests/feeds-list.spec.ts` - Feeds page functionality
- `e2e/tests/api-validation.spec.ts` - API endpoint validation

## For AI Agents

After making code changes, validate with:

```bash
cd services/backend-api-next
npm run e2e
```

If you see "Session expired!" or "auth.json not found!", inform the user:

> Please run `npm run e2e:auth` to refresh your session, then I'll continue.
