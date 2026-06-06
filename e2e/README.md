# E2E Testing with Playwright

This directory contains end-to-end tests for the MonitoRSS system using Playwright. Tests run against a mock Discord API server, so no real Discord authentication is needed.

## Prerequisites

The E2E Docker stack (defined in `docker-compose.e2e.yml`) provides all required services. The `e2e-mock.sh` script handles starting and tearing down the stack automatically.

## Running Tests

`e2e-mock.sh` is the canonical wrapper: it brings up the full Docker stack (`up -d --build --wait`), runs Playwright, and tears the stack down on exit. **Any arguments after the script name are forwarded straight to `playwright test`**, so you can scope a run to a single file and/or project. Always go through this script (or the `npm run e2e*` aliases) rather than starting the stack and Playwright by hand — `--build` is required because the `web-api` source is baked into its image (no bind mount), so backend changes won't take effect otherwise.

The script writes two logs to `e2e/logs/` (gitignored) that outlive the torn-down stack:

- `logs/playwright.log` — the full Playwright run output.
- `logs/docker-stack.log` — `docker compose logs` for all services, captured just before teardown. This is the only place to inspect container-side behaviour after a run, e.g. inbound Paddle webhooks in `web-api` ("Paddle webhook received" / "Invalid signature received for paddle webhook event").

```bash
# Run all regular (non-paddle) tests via Docker stack (defaults to --project=e2e-web)
npm run e2e

# Run a single web spec file
bash e2e-mock.sh --project=e2e-web tests/feeds/bulk-delete-feeds.spec.ts

# Run a single paddle spec (requires cloudflared on PATH + Paddle keys in e2e/.env)
bash e2e-mock.sh --project=e2e-paddle tests/billing/paddle-retain-cancellation.spec.ts

# Run only regular (non-paddle) tests (assumes Docker stack is already running)
npx playwright test --project=e2e-web

# Run only paddle tests (requires cloudflared + Paddle key)
npm run e2e:paddle

# Run tests with UI
npm run e2e:ui

# View test report
npm run e2e:report
```

> **Which project does my spec belong to?** Anything matching `tests/billing/paddle-*.spec.ts` or `branding-paddle-overlay.spec.ts` is in the `e2e-paddle` project (see `PADDLE_CHECKOUT_TESTS` in `playwright.config.ts`), which depends on `e2e-paddle-setup` (starts a cloudflared tunnel + configures the Paddle sandbox webhook). Everything else is `e2e-web`. Paddle specs require `cloudflared` on PATH and `BACKEND_API_PADDLE_KEY` / `_URL` / `_WEBHOOK_SECRET` in `e2e/.env` — even ones that mock the request under test, because their setup still provisions a real sandbox subscription.

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
2. **`BACKEND_API_PADDLE_KEY`** environment variable set in `e2e/.env` (or `.env.local` at the repo root). This is the Paddle sandbox API key used to create the notification setting, manage notification URLs, and cancel subscriptions.

> **Your local dev notification setting is never touched.** Earlier this suite repointed a *shared* notification setting's `destination` at the tunnel, which hijacked local dev's webhook delivery. Now `e2e-mock.sh` **creates an ephemeral notification setting per run** (via the Paddle API), exports its signing secret as `BACKEND_API_PADDLE_WEBHOOK_SECRET` **before the backend boots** (so HMAC verification matches), and **deletes the setting on teardown**. By default, do not set `BACKEND_API_PADDLE_WEBHOOK_SECRET` in `e2e/.env` — the script provides it.
>
> **Bring your own setting (optional).** If you'd rather use a notification setting you manage, set `E2E_PADDLE_NOTIFICATION_SETTING_ID` in `e2e/.env` along with that setting's own `BACKEND_API_PADDLE_WEBHOOK_SECRET`. The script then skips create/delete and leaves your setting in place, only repointing its `destination` at the tunnel during setup. (Use a setting dedicated to E2E, not your local dev one — setup will overwrite its destination.)

### How It Works

1. **Before stack boot** (`e2e-mock.sh`): if `E2E_PADDLE_NOTIFICATION_SETTING_ID` is already set, it's used as-is; otherwise, when `BACKEND_API_PADDLE_KEY` is set, the script creates an ephemeral Paddle notification setting, captures its `endpoint_secret_key`, exports it as `BACKEND_API_PADDLE_WEBHOOK_SECRET` and the new setting's id as `E2E_PADDLE_NOTIFICATION_SETTING_ID`, then brings up the stack so the backend boots already knowing the secret. The trap deletes only a setting the script itself created.

2. **Setup** (`tests/paddle.setup.ts`):
   - Starts a Cloudflare Tunnel to expose the backend with a public URL
   - Points the ephemeral E2E notification setting's `destination` at the tunnel URL

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

**Assert through the rendered UI, never via API calls.** Verify outcomes by navigating to the relevant page (e.g. a feed's connections view) and asserting on what is displayed (`getByRole`, `toBeVisible`, `toHaveCount(0)`, input values). Do NOT assert outcomes with `page.request.*` — API calls are only for test setup/teardown (creating and deleting fixtures), never for the assertion itself. An API assertion both diverges from real user behavior and can produce misleading results when its endpoint/shape differs from what the UI shows.

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
