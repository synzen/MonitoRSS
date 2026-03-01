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
# Run all tests (regular + paddle)
npm run e2e

# Run only regular (non-paddle) tests
npx playwright test --project=chromium

# Run only paddle tests (requires cloudflared + Paddle key)
npm run e2e:paddle

# Run tests with UI
npm run e2e:ui

# View test report
npm run e2e:report
```

## Project Structure

The single `playwright.config.ts` defines 5 projects:

| Project           | Purpose                                                      | Dependencies                         |
| ----------------- | ------------------------------------------------------------ | ------------------------------------ |
| `auth-setup`      | Validates Discord auth session                               | —                                    |
| `paddle-setup`    | Starts tunnel, configures Paddle webhooks, ensures free tier | `auth-setup`                         |
| `paddle-teardown` | Cancels subscriptions, stops tunnel                          | (auto, via teardown on paddle-setup) |
| `chromium`        | Regular tests (non-paddle)                                   | `auth-setup`                         |
| `paddle`          | Paddle checkout tests                                        | `auth-setup`, `paddle-setup`         |

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

- `e2e/tests/auth.setup.ts` - Auth session validation (setup project)
- `e2e/tests/paddle.setup.ts` - Paddle tunnel + webhook setup (setup project)
- `e2e/tests/paddle.teardown.ts` - Paddle cleanup (teardown project)
- `e2e/tests/*.spec.ts` - Test files

## Paddle Checkout Tests

The Paddle checkout E2E tests (`13-branding-fields.spec.ts`, `14-paddle-checkout.spec.ts`, `15-paddle-branding-checkout.spec.ts`, `16-paddle-retain-cancellation.spec.ts`) verify subscription flows through Paddle's sandbox environment.

### Prerequisites

1. All standard prerequisites above (Docker stack running, authenticated session)
2. **cloudflared** installed and available in PATH:
   ```bash
   winget install cloudflare.cloudflared
   ```
3. **`BACKEND_API_PADDLE_KEY`** environment variable set in `.env.local` (or `.env`) at the repo root. This is the Paddle sandbox API key used to manage notification URLs and cancel subscriptions.

### How It Works

1. **Setup** (`e2e/tests/paddle.setup.ts`):
   - Starts a Cloudflare Tunnel to expose `localhost:8000` with a public URL
   - Updates the Paddle notification setting to point the webhook at the tunnel URL
   - Cancels any existing active subscriptions and waits for the user to be on the Free tier

2. **Tests**: Navigate to checkout pages, fill Paddle iframes with test card credentials (`4242 4242 4242 4242`), and submit. Wait for webhook processing and benefit provisioning.

3. **Teardown** (`e2e/tests/paddle.teardown.ts`):
   - Cancels any active subscriptions created during the test
   - Waits for the user to return to the Free tier
   - Stops the Cloudflare Tunnel

### Running

```bash
npm run e2e:paddle
```

This uses the `--project=paddle` flag, which automatically runs `auth-setup` and `paddle-setup` first, then `paddle-teardown` after.

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

To run only regular (non-paddle) tests:

```bash
npx playwright test --project=chromium
```

If you see "Session expired!" or "auth.json not found!", inform the user:

> Please run `npm run e2e:auth` to refresh your session, then I'll continue.
