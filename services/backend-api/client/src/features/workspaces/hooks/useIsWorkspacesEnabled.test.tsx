import { renderHook } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useIsWorkspacesEnabled } from "./useIsWorkspacesEnabled";
import { useUserMe } from "@/features/discordUser";

vi.mock("@/features/discordUser", () => ({
  useUserMe: vi.fn(),
}));

const mockUserMe = (capabilities: boolean | undefined, featureFlag: boolean | undefined) =>
  vi.mocked(useUserMe).mockReturnValue({
    data: {
      result: {
        capabilities: capabilities === undefined ? undefined : { workspaces: capabilities },
        featureFlags: featureFlag === undefined ? undefined : { workspaces: featureFlag },
      },
    },
    status: "success",
    fetchStatus: "idle",
  } as never);

describe("useIsWorkspacesEnabled", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("is enabled only when both the capability and the per-user flag are true", () => {
    mockUserMe(true, true);
    expect(renderHook(() => useIsWorkspacesEnabled()).result.current.enabled).toBe(true);
  });

  it("is disabled when the deployment capability is off", () => {
    mockUserMe(false, true);
    expect(renderHook(() => useIsWorkspacesEnabled()).result.current.enabled).toBe(false);
  });

  it("is disabled when the per-user flag is off", () => {
    mockUserMe(true, false);
    expect(renderHook(() => useIsWorkspacesEnabled()).result.current.enabled).toBe(false);
  });

  it("is disabled when both are off", () => {
    mockUserMe(false, false);
    expect(renderHook(() => useIsWorkspacesEnabled()).result.current.enabled).toBe(false);
  });

  it("is disabled while the user is still loading", () => {
    vi.mocked(useUserMe).mockReturnValue({
      data: undefined,
      status: "loading",
      fetchStatus: "fetching",
    } as never);

    const { result } = renderHook(() => useIsWorkspacesEnabled());
    expect(result.current.enabled).toBe(false);
    expect(result.current.status).toBe("loading");
  });
});
