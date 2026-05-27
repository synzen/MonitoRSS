# E2E Testing with Playwright

This directory contains end-to-end tests for the MonitoRSS system using Playwright. Tests run against a mock Discord API server, so no real Discord authentication is needed.

## Prerequisites

The E2E Docker stack (defined in `docker-compose.e2e.yml`) provides all required services. The `e2e-mock.sh` script handles starting and tearing down the stack automatically.

## Running Tests

```bash
# Run all regular (non-paddle) tests via Docker stack
npm run e2e

# Run only regular (non-paddle) tests (assumes Docker stack is already running)
npx playwright test --project=e2e-web

# Run only paddle tests (requires cloudflared + Paddle key)
npm run e2e:paddle

# Run tests with UI
npm run e2e:ui

# View test report
npm run e2e:report
```

## Project Structure

The single `playwright.config.ts` defines 4 projects:

| Project           | Purpose                                   | Dependencies                         |
| ----------------- | ----------------------------------------- | ------------------------------------ |
| `e2e-paddle-setup`    | Starts tunnel, configures Paddle webhooks | —                                        |
| `e2e-paddle-teardown` | Cancels subscriptions, stops tunnel       | (auto, via teardown on e2e-paddle-setup) |
| `e2e-web`             | Regular tests (non-paddle)                | —                                        |
| `e2e-paddle`          | Paddle checkout tests                     | `e2e-paddle-setup`                       |

## Paddle Checkout Tests

The Paddle checkout E2E tests (`14-paddle-checkout.spec.ts`, `15-paddle-branding-checkout.spec.ts`, `16-paddle-retain-cancellation.spec.ts`) verify subscription flows through Paddle's sandbox environment.

### Prerequisites

1. **cloudflared** installed and available in PATH:
   ```bash
   winget install cloudflare.cloudflared
   ```
2. **`BACKEND_API_PADDLE_KEY`** environment variable set in `.env.local` (or `.env`) at the repo root. This is the Paddle sandbox API key used to manage notification URLs and cancel subscriptions.

### How It Works

1. **Setup** (`tests/paddle.setup.ts`):
   - Starts a Cloudflare Tunnel to expose the backend with a public URL
   - Updates the Paddle notification setting to point the webhook at the tunnel URL

2. **Tests**: Navigate to checkout pages, fill Paddle iframes with test card credentials (`4242 4242 4242 4242`), and submit. Wait for webhook processing and benefit provisioning.

3. **Teardown** (`tests/paddle.teardown.ts`):
   - Cancels any active subscriptions created during the test
   - Stops the Cloudflare Tunnel

### Running

```bash
npm run e2e:paddle
```

### Troubleshooting

- **"Failed to start cloudflared"**: Ensure `cloudflared` is installed and in your PATH. You can also set the `CLOUDFLARED_PATH` environment variable to the full path of the binary.
- **"Timed out waiting for cloudflared tunnel URL"**: The tunnel failed to start within 30 seconds. Check your internet connection and try again.
- **"BACKEND_API_PADDLE_KEY is not set"**: Add the Paddle sandbox API key to your `.env.local` file at the repo root.
- **Test times out waiting for "Your benefits have been provisioned"**: The webhook may not have reached the backend. Verify the Docker stack is running and the tunnel URL was correctly set up (check the setup logs).

## For AI Agents

After making code changes, validate with:

```bash
# From repo root
npm run e2e

# Or from this directory
npm run e2e
```

To run only regular (non-paddle) tests (assumes Docker stack is already running):

```bash
npx playwright test --project=e2e-web
```

E2E tests that need a paid/supporter user (e.g. creating webhook connections) should use `setSupporterStatusInDb()` and `clearSupporterStatusInDb()` from `helpers/paddle-db.ts` to set supporter status directly in MongoDB. Do NOT use `ensurePaidSubscriptionState` from `paddle-cleanup.ts` as it relies on Paddle simulation webhooks delivered via Cloudflare tunnels, which is unreliable. Always clean up supporter status in a `finally` block to avoid affecting other tests.

Paddle tests require `--project=e2e-paddle` (e.g. `npx playwright test --project=e2e-paddle`). Regular tests use `--project=e2e-web`. Running `npx playwright test` runs everything.
