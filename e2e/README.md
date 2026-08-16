# E2E Testing with Playwright

This directory contains end-to-end tests for the MonitoRSS system using Playwright. Tests run against a mock Discord API server, so no real Discord authentication is needed.

## Prerequisites

The E2E Docker stack (defined in `docker-compose.e2e.yml`) provides all required services. The TypeScript runner handles prerequisite checks, startup, logs, and teardown automatically on Windows and Linux.

## Running Tests

`npm run e2e` is the canonical entrypoint: it checks prerequisites, brings up the full Docker stack (`up -d --build --wait`), runs Playwright, and tears the stack down on exit. Spec paths after `--` are forwarded to `playwright test`. npm consumes flag-shaped arguments on some platforms, so use a second separator before raw Playwright flags, for example `npm run e2e:web -- -- --grep="feed settings"`. Always use an `npm run e2e*` command rather than starting the stack and Playwright by hand.

Run `npm run e2e:doctor` for a fast check of Docker daemon access, Docker Compose, and the Playwright Chromium installation. Pass a billing spec after `--`, or use `npm run e2e:doctor -- -- --project=e2e-paddle`, to include cloudflared and Paddle configuration checks.

The runner writes logs to `e2e/logs/` (gitignored) that outlive the torn-down stack. **If a run fails, read `logs/combined.log` first** — it is the one file containing everything, top to bottom:

- `logs/combined.log` — **read this first after a run ends.** Runner output + Playwright output + every container's logs + all four mock servers, concatenated under `===== SECTION =====` headers. Assembled on teardown.
- `logs/runner.log` — Docker startup, failure diagnostics, and teardown output.
- `logs/playwright.log` — the Playwright run output, written live.
- `logs/docker-stack.log` — `docker compose logs --timestamps --follow` for all services, streamed **live** for the whole run. The place to inspect container-side behaviour, e.g. inbound Paddle webhooks in `web-api` ("Paddle webhook received" / "Invalid signature received for paddle webhook event").
- `logs/mock-rss.log`, `logs/mock-discord.log`, `logs/mock-smtp.log`, `logs/mock-reddit.log` — the host-side mock servers Playwright launches, written live. Look here for things like `[mock-discord] Unmatched: <method> <path>` when a request isn't being mocked.

`combined.log` is assembled on teardown, so it only exists once the run ends. **While a run is still going, read the source logs above — they are all written live.** Runner startup and teardown output is captured in `logs/runner.log`.

Concurrent runs (`E2E_INSTANCE > 0`) suffix every live log file with `-<instance>` (e.g. `combined-1.log`). Every completed run is also archived under `logs/runs/<timestamp>-<instance>/`; `logs/latest-run[-<instance>].txt` identifies the newest archive.

```bash
# Run all regular (non-paddle) tests via Docker stack (defaults to --project=e2e-web)
npm run e2e

# Check prerequisites without starting the stack
npm run e2e:doctor

# Run a single web spec file
npm run e2e -- tests/feeds/bulk-delete-feeds.spec.ts

# Run a single paddle spec (requires cloudflared on PATH + Paddle keys in e2e/.env)
npm run e2e -- tests/billing/paddle-retain-cancellation.spec.ts

# Run only regular (non-paddle) tests through the managed stack
npm run e2e:web

# Run only paddle tests (requires cloudflared + Paddle key)
npm run e2e:paddle

# Run tests with UI
npm run e2e:ui

# Run headed without Playwright's UI mode (PowerShell)
$env:E2E_HEADED=1; npm run e2e -- tests/feeds/bulk-delete-feeds.spec.ts

# View test report
npm run e2e:report
```

> **Which project does my spec belong to?** Anything listed in `PADDLE_CHECKOUT_TESTS` in `playwright.config.ts` (all under `tests/billing/`) is in the `e2e-paddle` project, which depends on `e2e-paddle-setup` (starts a cloudflared tunnel + configures the Paddle sandbox webhook). Everything else is `e2e-web`. Paddle specs require `cloudflared` on PATH plus `BACKEND_API_PADDLE_KEY`, `BACKEND_API_PADDLE_URL`, and `VITE_PADDLE_CLIENT_TOKEN` in `e2e/.env` or `.env.local`. The runner creates the webhook secret unless a fixed notification setting is configured.

## Billing posture: e2e-web is always self-host (Paddle blanked)

The mock suite runs in exactly one billing posture per stack boot, so the runner makes it
deterministic: **any run that does not target the `e2e-paddle` project or a `tests/billing/` spec
gets the four Paddle vars (`BACKEND_API_PADDLE_KEY` / `_URL` / `_WEBHOOK_SECRET`,
`VITE_PADDLE_CLIENT_TOKEN`) force-blanked** before the stack boots. Values in `e2e/.env`, the
repo-root `.env` (which Docker Compose auto-loads from its project directory regardless of cwd),
or CI workflow env cannot leak in.

This matches what the `e2e-web` specs assume: feeds work in workspaces without subscriptions
(unlimited by default, capped only when the stack sets `BACKEND_API_DEFAULT_MAX_WORKSPACE_FEEDS`),
and `workspace-self-host-posture.spec.ts` asserts billing UI is absent entirely. A spec that needs a billing-enabled backend (e.g.
`dormant-workspace-feed-retry.spec.ts` — dormant workspaces only exist when Paddle is configured)
must live in `tests/billing/` and be listed in `PADDLE_CHECKOUT_TESTS` so it runs under
`e2e-paddle` with the real env.

## Project Structure

The single `playwright.config.ts` defines 4 projects:

| Project               | Purpose                                   | Dependencies                             |
| --------------------- | ----------------------------------------- | ---------------------------------------- |
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

> **Your local dev notification setting is never touched.** Earlier this suite repointed a _shared_ notification setting's `destination` at the tunnel, which hijacked local dev's webhook delivery. The runner now **creates an ephemeral notification setting per run** (via the Paddle API), exports its signing secret as `BACKEND_API_PADDLE_WEBHOOK_SECRET` **before the backend boots** (so HMAC verification matches), and **deletes the setting on teardown**. By default, do not set `BACKEND_API_PADDLE_WEBHOOK_SECRET` in `e2e/.env` — the runner provides it.
>
> **Bring your own setting (optional).** If you'd rather use a notification setting you manage, set `E2E_PADDLE_NOTIFICATION_SETTING_ID` in `e2e/.env` along with that setting's own `BACKEND_API_PADDLE_WEBHOOK_SECRET`. The runner then skips create/delete and leaves your setting in place, only repointing its `destination` at the tunnel during setup. (Use a setting dedicated to E2E, not your local dev one — setup will overwrite its destination.)

### How It Works

1. **Before stack boot**: if `E2E_PADDLE_NOTIFICATION_SETTING_ID` is already set, it's used as-is; otherwise, the runner creates an ephemeral Paddle notification setting, exports its secret as `BACKEND_API_PADDLE_WEBHOOK_SECRET` and its id as `E2E_PADDLE_NOTIFICATION_SETTING_ID`, then brings up the stack so the backend boots already knowing the secret. Cleanup deletes only a setting the runner itself created.

2. **Setup** (`tests/paddle.setup.ts`):
   - Starts a Cloudflare Tunnel to expose the backend with a public URL
   - Points the ephemeral E2E notification setting's `destination` at the tunnel URL

3. **Tests**: Navigate to checkout pages, fill Paddle iframes with test card credentials (`4242 4242 4242 4242`), and submit. Wait for webhook processing and benefit provisioning.

4. **Teardown** (`tests/paddle.teardown.ts`):
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

To run only regular (non-paddle) tests through the managed stack:

```bash
npm run e2e:web
```

E2E tests that need a paid/supporter user (e.g. creating webhook connections) should use `setSupporterStatusInDb()` and `clearSupporterStatusInDb()` from `helpers/paddle-db.ts` to set supporter status directly in MongoDB. Do NOT use `ensurePaidSubscriptionState` from `paddle-cleanup.ts` as it relies on Paddle simulation webhooks delivered via Cloudflare tunnels, which is unreliable. Always clean up supporter status in a `finally` block to avoid affecting other tests.

Use `npm run e2e:paddle` for all Paddle tests and `npm run e2e:web` for regular tests. A single billing spec passed to `npm run e2e -- tests/billing/<file>.spec.ts` selects the Paddle lifecycle automatically.
