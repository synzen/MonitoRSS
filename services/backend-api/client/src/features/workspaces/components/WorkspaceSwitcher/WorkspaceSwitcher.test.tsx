import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider } from "@chakra-ui/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { system } from "@/utils/theme";
import { WorkspaceSwitcher } from "./index";
import { useWorkspaces } from "../../hooks";

const h = vi.hoisted(() => ({
  navigate: vi.fn(),
  params: { current: {} as { workspaceSlug?: string } },
}));

vi.mock("../../hooks", () => ({
  useWorkspaces: vi.fn(),
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();

  return {
    ...actual,
    useNavigate: () => h.navigate,
    useParams: () => h.params.current,
  };
});

const mockWorkspaces = (overrides: Record<string, unknown>) =>
  vi.mocked(useWorkspaces).mockReturnValue({
    status: "success",
    workspaces: [],
    refetch: vi.fn(),
    ...overrides,
  } as never);

const renderSwitcher = (onCreateWorkspace = vi.fn()) => {
  render(
    <ChakraProvider value={system}>
      <WorkspaceSwitcher onCreateWorkspace={onCreateWorkspace} />
    </ChakraProvider>,
  );

  return onCreateWorkspace;
};

describe("WorkspaceSwitcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.params.current = {};
  });

  it("labels the trigger with Personal in personal scope", () => {
    mockWorkspaces({
      workspaces: [{ id: "t1", name: "Acme", slug: "acme-marketing", role: "admin" }],
    });

    renderSwitcher();

    expect(
      screen.getByRole("button", {
        name: "Switch team, current: Personal",
      }),
    ).toBeInTheDocument();
  });

  it("labels the trigger with the active workspace name in workspace scope", () => {
    h.params.current = { workspaceSlug: "acme-marketing" };
    mockWorkspaces({
      workspaces: [{ id: "t1", name: "Acme", slug: "acme-marketing", role: "admin" }],
    });

    renderSwitcher();

    expect(screen.getByRole("button", { name: "Switch team, current: Acme" })).toBeInTheDocument();
  });

  it("lists Personal plus each workspace, with the active one checked", async () => {
    h.params.current = { workspaceSlug: "acme-marketing" };
    mockWorkspaces({
      workspaces: [
        { id: "t1", name: "Acme", slug: "acme-marketing", role: "admin" },
        { id: "t2", name: "Bookclub", slug: "bookclub", role: "owner" },
      ],
    });

    renderSwitcher();
    fireEvent.click(screen.getByRole("button", { name: /switch team/i }));

    expect(await screen.findByRole("menuitemradio", { name: "Personal" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
    expect(screen.getByRole("menuitemradio", { name: "Acme" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("navigates to personal feeds when Personal is chosen", async () => {
    h.params.current = { workspaceSlug: "acme-marketing" };
    mockWorkspaces({
      workspaces: [{ id: "t1", name: "Acme", slug: "acme-marketing", role: "admin" }],
    });

    renderSwitcher();
    await userEvent.click(screen.getByRole("button", { name: /switch team/i }));
    await userEvent.click(await screen.findByRole("menuitemradio", { name: "Personal" }));

    expect(h.navigate).toHaveBeenCalledWith("/feeds");
  });

  it("navigates to a workspace's feeds when that workspace is chosen", async () => {
    mockWorkspaces({
      workspaces: [{ id: "t1", name: "Acme", slug: "acme-marketing", role: "admin" }],
    });

    renderSwitcher();
    await userEvent.click(screen.getByRole("button", { name: /switch team/i }));
    await userEvent.click(await screen.findByRole("menuitemradio", { name: "Acme" }));

    expect(h.navigate).toHaveBeenCalledWith("/workspaces/acme-marketing/feeds");
  });

  it("hides the workspace-settings item in personal scope", async () => {
    mockWorkspaces({
      workspaces: [{ id: "t1", name: "Acme", slug: "acme-marketing", role: "admin" }],
    });

    renderSwitcher();
    fireEvent.click(screen.getByRole("button", { name: /switch team/i }));

    expect(await screen.findByRole("menuitem", { name: /create team/i })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /settings/i })).not.toBeInTheDocument();
  });

  it("shows the workspace-settings item in workspace scope", async () => {
    h.params.current = { workspaceSlug: "acme-marketing" };
    mockWorkspaces({
      workspaces: [{ id: "t1", name: "Acme", slug: "acme-marketing", role: "admin" }],
    });

    renderSwitcher();
    fireEvent.click(screen.getByRole("button", { name: /switch team/i }));

    expect(await screen.findByRole("menuitem", { name: /Acme settings/i })).toBeInTheDocument();
  });

  it("opens the create-workspace dialog from the footer action", async () => {
    mockWorkspaces({
      workspaces: [{ id: "t1", name: "Acme", slug: "acme-marketing", role: "admin" }],
    });

    const onCreateWorkspace = renderSwitcher();
    fireEvent.click(screen.getByRole("button", { name: /switch team/i }));
    const items = await screen.findAllByRole("menuitem", {
      name: /create team/i,
    });
    fireEvent.click(items[items.length - 1]);

    expect(onCreateWorkspace).toHaveBeenCalled();
  });

  it("surfaces a retryable error when the workspaces query fails", async () => {
    const refetch = vi.fn();
    mockWorkspaces({
      status: "error",
      workspaces: undefined,
      error: { message: "Boom" },
      refetch,
    });

    renderSwitcher();
    fireEvent.click(screen.getByRole("button", { name: /switch team/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't load teams");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(refetch).toHaveBeenCalled();
  });
});
