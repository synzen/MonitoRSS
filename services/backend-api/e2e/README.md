# E2E Testing with Playwright

This directory contains end-to-end tests for the backend-api service using Playwright.

## Prerequisites

1. Docker stack must be running - source changes will automatically restart container:

   ```bash
   docker compose -f docker-compose.dev.yml watch
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

## Paddle Checkout Tests

The Paddle checkout E2E test (`14-paddle-checkout.spec.ts`) verifies the full subscription flow through Paddle's sandbox environment. It uses a separate Playwright config and has additional requirements.

### Prerequisites

1. All standard prerequisites above (Docker stack running, authenticated session)
2. **cloudflared** installed and available in PATH:
   ```bash
   winget install cloudflare.cloudflared
   ```
3. **`BACKEND_API_PADDLE_KEY`** environment variable set in `.env.local` (or `.env`) at the repo root. This is the Paddle sandbox API key used to manage notification URLs and cancel subscriptions.

### How It Works

1. **Setup** (`paddle-setup.ts`):
   - Validates the auth session
   - Starts a Cloudflare Tunnel to expose `localhost:8000` with a public URL
   - Updates the Paddle notification setting (`ntfset_01hbxt19pg3xeqjn4adhh8am17`) to point the webhook at the tunnel URL
   - Cancels any existing active subscriptions and waits for the user to be on the Free tier

2. **Test**: Navigates to the checkout page, fills the Paddle iframe with test card credentials (`4242 4242 4242 4242`), and submits. Waits for the webhook to be processed and benefits to be provisioned.

3. **Teardown** (`paddle-teardown.ts`):
   - Cancels any active subscriptions created during the test
   - Waits for the user to return to the Free tier
   - Stops the Cloudflare Tunnel

### Running

```bash
npm run e2e:paddle
```

This runs in headed mode (non-headless) with no retries, since the checkout flow involves real Paddle sandbox transactions.

### Troubleshooting

- **"Failed to start cloudflared"**: Ensure `cloudflared` is installed and in your PATH. You can also set the `CLOUDFLARED_PATH` environment variable to the full path of the binary.
- **"Timed out waiting for cloudflared tunnel URL"**: The tunnel failed to start within 30 seconds. Check your internet connection and try again.
- **"BACKEND_API_PADDLE_KEY is not set"**: Add the Paddle sandbox API key to your `.env.local` file at the repo root.
- **Test times out waiting for "Your benefits have been provisioned"**: The webhook may not have reached the backend. Verify the Docker stack is running and the tunnel URL was correctly set up (check the setup logs).

## For AI Agents

After making code changes, validate with:

```bash
cd services/backend-api
npm run e2e
```

If you see "Session expired!" or "auth.json not found!", inform the user:

> Please run `npm run e2e:auth` to refresh your session, then I'll continue.
