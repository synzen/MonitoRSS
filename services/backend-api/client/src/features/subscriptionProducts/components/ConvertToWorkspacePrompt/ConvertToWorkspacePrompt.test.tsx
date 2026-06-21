import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChakraProvider } from "@chakra-ui/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { system } from "@/utils/theme";
import { ProductKey } from "@/constants";
import { ConvertToWorkspacePrompt } from "./index";
import { useUserMe } from "../../../discordUser";
import { useIsWorkspacesEnabled, useWorkspaces } from "../../../workspaces";

vi.mock("../../../discordUser", () => ({
  useUserMe: vi.fn(),
}));

vi.mock("../../../workspaces", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../workspaces")>()),
  useIsWorkspacesEnabled: vi.fn(),
  useWorkspaces: vi.fn(),
  CreateWorkspaceDialog: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div role="dialog" aria-label="Create a workspace" /> : null,
}));

const mockUser = (productKey: ProductKey) => {
  vi.mocked(useUserMe).mockReturnValue({
    data: { result: { subscription: { product: { key: productKey } } } },
  } as never);
};

const mockWorkspaces = (workspaces: Array<{ role: "owner" | "admin" }> = []) => {
  vi.mocked(useWorkspaces).mockReturnValue({ workspaces } as never);
};

const renderPrompt = (variant: "banner" | "card") =>
  render(
    <ChakraProvider value={system}>
      <ConvertToWorkspacePrompt variant={variant} />
    </ChakraProvider>,
  );

describe("ConvertToWorkspacePrompt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.mocked(useIsWorkspacesEnabled).mockReturnValue({ enabled: true } as never);
    mockWorkspaces([]);
  });

  it.each([ProductKey.Tier2, ProductKey.Tier3])(
    "offers conversion to a convertible %s subscriber",
    (productKey) => {
      mockUser(productKey);

      renderPrompt("banner");

      expect(screen.getByText(/your personal plan can become a workspace/i)).toBeInTheDocument();
    },
  );

  it.each([ProductKey.Free, ProductKey.Tier1])(
    "shows nothing to a non-convertible %s subscriber",
    (productKey) => {
      mockUser(productKey);

      const { container } = renderPrompt("banner");

      expect(container).toBeEmptyDOMElement();
    },
  );

  it("shows nothing when workspaces are disabled, even for a convertible subscriber", () => {
    mockUser(ProductKey.Tier2);
    vi.mocked(useIsWorkspacesEnabled).mockReturnValue({ enabled: false } as never);

    const { container } = renderPrompt("banner");

    expect(container).toBeEmptyDOMElement();
  });

  it("shows nothing when the convertible subscriber already owns a workspace", () => {
    // They should convert from that workspace's billing page, not be pushed to
    // create a second workspace.
    mockUser(ProductKey.Tier2);
    mockWorkspaces([{ role: "owner" }]);

    const { container } = renderPrompt("banner");

    expect(container).toBeEmptyDOMElement();
  });

  it("still offers conversion when the user is only an admin (not owner) elsewhere", () => {
    mockUser(ProductKey.Tier2);
    mockWorkspaces([{ role: "admin" }]);

    renderPrompt("banner");

    expect(screen.getByText(/your personal plan can become a workspace/i)).toBeInTheDocument();
  });

  it("opens the create-workspace flow from the prompt's CTA", () => {
    mockUser(ProductKey.Tier2);

    renderPrompt("banner");

    fireEvent.click(screen.getByRole("button", { name: /create a workspace/i }));
    expect(screen.getByRole("dialog", { name: /create a workspace/i })).toBeInTheDocument();
  });

  it("is dismissible in the card variant", () => {
    mockUser(ProductKey.Tier2);

    renderPrompt("card");

    expect(screen.getByText(/your personal plan can become a workspace/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(
      screen.queryByText(/your personal plan can become a workspace/i),
    ).not.toBeInTheDocument();
  });

  it("is not dismissible in the banner variant", () => {
    mockUser(ProductKey.Tier2);

    renderPrompt("banner");

    expect(screen.queryByRole("button", { name: /dismiss/i })).not.toBeInTheDocument();
  });
});
