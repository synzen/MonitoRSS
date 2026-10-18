import { afterEach, describe, expect, it, vi } from "vitest";

// The constant is evaluated at module load, so each case needs a fresh copy.
const loadModule = async () => {
  vi.resetModules();

  return import("./paddleEnvironment");
};

describe("PADDLE_ENVIRONMENT", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("defaults to sandbox outside of production builds", async () => {
    vi.stubEnv("VITE_PADDLE_ENVIRONMENT", "");
    const { PADDLE_ENVIRONMENT } = await loadModule();

    expect(PADDLE_ENVIRONMENT).toBe("sandbox");
  });

  it("prefers an explicit environment over the build mode", async () => {
    vi.stubEnv("VITE_PADDLE_ENVIRONMENT", "production");
    const { PADDLE_ENVIRONMENT } = await loadModule();

    expect(PADDLE_ENVIRONMENT).toBe("production");

    vi.stubEnv("VITE_PADDLE_ENVIRONMENT", "sandbox");
    const { PADDLE_ENVIRONMENT: explicitSandbox } = await loadModule();

    expect(explicitSandbox).toBe("sandbox");
  });

  it("ignores invalid explicit values", async () => {
    vi.stubEnv("VITE_PADDLE_ENVIRONMENT", "staging");
    const { PADDLE_ENVIRONMENT } = await loadModule();

    expect(PADDLE_ENVIRONMENT).toBe("sandbox");
  });
});
