import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { ChakraProvider } from "@chakra-ui/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { system } from "@/utils/theme";
import { WorkspaceScopeLayout } from "./index";
import { useIsWorkspacesEnabled, useWorkspace } from "../../hooks";

// The two gate hooks are driven per-test. useRefetchFeedsOnWorkspaceActivation is
// a fire-and-forget effect hook (it calls useQueryClient internally, which needs a
// provider this test does not mount), so it is stubbed to a no-op rather than kept
// real — the layout calls it unconditionally and these tests assert routing, not
// the refetch side effect.
vi.mock("../../hooks", () => ({
  useIsWorkspacesEnabled: vi.fn(),
  useWorkspace: vi.fn(),
  useRefetchFeedsOnWorkspaceActivation: vi.fn(),
}));

// Provide the workspace context providers the layout mounts as pass-throughs,
// without a real query. Both providers the component wraps with must be present
// or it throws on an undefined component.
vi.mock("../../contexts", () => ({
  CurrentWorkspaceProvider: ({ children }: { children: React.ReactNode }) => children,
  JustConvertedWorkspaceProvider: ({ children }: { children: React.ReactNode }) => children,
}));

const renderLayout = () =>
  render(
    <ChakraProvider value={system}>
      <MemoryRouter initialEntries={["/workspaces/acme-marketing/feeds"]}>
        <Routes>
          <Route path="/workspaces/:workspaceSlug" element={<WorkspaceScopeLayout />}>
            <Route path="feeds" element={<div>SCOPED CONTENT</div>} />
          </Route>
          <Route path="/not-found" element={<div>NOT FOUND PAGE</div>} />
        </Routes>
      </MemoryRouter>
    </ChakraProvider>,
  );

describe("WorkspaceScopeLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the scoped page for a member of an enabled workspace", async () => {
    vi.mocked(useIsWorkspacesEnabled).mockReturnValue({
      enabled: true,
      status: "success",
    } as never);
    vi.mocked(useWorkspace).mockReturnValue({
      status: "success",
      workspace: {
        id: "workspace-1",
        name: "Acme",
        slug: "acme-marketing",
        role: "admin",
      },
      error: null,
    } as never);

    renderLayout();

    expect(await screen.findByText("SCOPED CONTENT")).toBeInTheDocument();
  });

  it("redirects to not-found when the workspace is inaccessible (404)", () => {
    vi.mocked(useIsWorkspacesEnabled).mockReturnValue({
      enabled: true,
      status: "success",
    } as never);
    vi.mocked(useWorkspace).mockReturnValue({
      status: "error",
      workspace: undefined,
      error: { message: "Workspace not found" },
    } as never);

    renderLayout();

    expect(screen.getByText("NOT FOUND PAGE")).toBeInTheDocument();
    expect(screen.queryByText("SCOPED CONTENT")).not.toBeInTheDocument();
  });

  it("redirects to not-found when the workspaces feature is disabled", () => {
    vi.mocked(useIsWorkspacesEnabled).mockReturnValue({
      enabled: false,
      status: "success",
    } as never);
    vi.mocked(useWorkspace).mockReturnValue({
      status: "loading",
      workspace: undefined,
      error: null,
    } as never);

    renderLayout();

    expect(screen.getByText("NOT FOUND PAGE")).toBeInTheDocument();
  });

  it("shows neither content nor not-found while the gate is resolving", () => {
    vi.mocked(useIsWorkspacesEnabled).mockReturnValue({
      enabled: false,
      status: "loading",
    } as never);
    vi.mocked(useWorkspace).mockReturnValue({
      status: "loading",
      workspace: undefined,
      error: null,
    } as never);

    renderLayout();

    expect(screen.queryByText("SCOPED CONTENT")).not.toBeInTheDocument();
    expect(screen.queryByText("NOT FOUND PAGE")).not.toBeInTheDocument();
  });
});
