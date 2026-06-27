/* eslint-disable import/no-extraneous-dependencies */
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";

/**
 * MSW node server for the unit/component test environment.
 *
 * This intentionally does NOT import the rich `./handlers` set used by the dev
 * browser worker. Those handlers transitively import app modules (`@/features/*`),
 * and pulling that graph into `setupTests.ts` loads the real modules before
 * Vitest hoists per-test `vi.mock(...)` calls, silently defeating component mocks.
 *
 * Instead we mock only the high-frequency app-shell requests that nearly every
 * rendered component fires (user/bot/auth-status) plus the SDK's own error
 * reporter. Everything else is left to `onUnhandledRequest: "error"` so that a
 * test relying on an unmocked endpoint fails loudly instead of silently hitting
 * the network (which previously produced thousands of ECONNREFUSED log lines).
 *
 * A test that needs a specific endpoint should add it with `testServer.use(...)`.
 */
const handlers = [
  http.get("/api/v1/users/@me", () => HttpResponse.json({ result: {} })),
  http.get("/api/v1/discord-users/@me", () => HttpResponse.json({ result: {} })),
  http.get("/api/v1/discord-users/bot", () => HttpResponse.json({ result: {} })),
  http.get("/api/v1/discord-users/@me/auth-status", () =>
    HttpResponse.json({ authenticated: true }),
  ),
  http.post("/api/v1/discovery-search-events", () => new HttpResponse(null, { status: 204 })),
  http.post("/api/v1/error-reports", () => new HttpResponse(null, { status: 204 })),
];

export const testServer = setupServer(...handlers);
