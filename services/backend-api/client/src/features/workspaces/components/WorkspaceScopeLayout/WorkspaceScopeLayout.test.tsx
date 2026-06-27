import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { ChakraProvider } from "@chakra-ui/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { system } from "@/utils/theme";
import { WorkspaceScopeLayout } from "./index";
import { useWorkspace } from "../../hooks";

// useWorkspace is driven per-test. useRefetchFeedsOnWorkspaceActivation is a
// fire-and-forget effect hook (it calls useQueryClient internally, which needs a
// provider this test does not mount), so it is stubbed to a no-op rather than kept
// real — the layout calls it unconditionally and these tests assert routing, not
// the refetch side effect.
vi.mock("../../hooks", () => ({
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

  it("renders the scoped page for a member of the workspace", async () => {
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
    vi.mocked(useWorkspace).mockReturnValue({
      status: "error",
      workspace: undefined,
      error: { message: "Workspace not found" },
    } as never);

    renderLayout();

    expect(screen.getByText("NOT FOUND PAGE")).toBeInTheDocument();
    expect(screen.queryByText("SCOPED CONTENT")).not.toBeInTheDocument();
  });

  it("shows neither content nor not-found while the workspace is loading", () => {
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
