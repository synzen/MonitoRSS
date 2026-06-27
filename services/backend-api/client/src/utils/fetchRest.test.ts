import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fetchRest from "./fetchRest";

const okResponse = () => new Response(null, { status: 204 });

const getSentHeaders = (mock: ReturnType<typeof vi.fn>): Record<string, string> => {
  const [, init] = mock.mock.calls[0];

  return (init?.headers ?? {}) as Record<string, string>;
};

describe("fetchRest", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue(okResponse());
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not set a JSON content type on a bodiless POST", async () => {
    // A bodiless POST with Content-Type: application/json is rejected by Fastify's
    // JSON parser ("Body cannot be empty"), which previously broke billing cancel/resume.
    await fetchRest("/api/v1/workspaces/foo/billing/cancel", {
      requestOptions: { method: "POST" },
      skipJsonParse: true,
    });

    expect(getSentHeaders(fetchMock)["Content-Type"]).toBeUndefined();
  });

  it("sets a JSON content type on a POST with a body", async () => {
    await fetchRest("/api/v1/workspaces/foo/billing/update", {
      requestOptions: { method: "POST", body: JSON.stringify({ prices: [] }) },
      skipJsonParse: true,
    });

    expect(getSentHeaders(fetchMock)["Content-Type"]).toBe("application/json");
  });
});
