import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { ChakraProvider } from "@chakra-ui/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { system } from "@/utils/theme";
import { openRedditLogin } from "@/utils/openRedditLogin";
import { RedditLoginButton } from "./RedditLoginButton";

let mockExternalAccounts: Array<{ type: string; status: string }> | undefined;
const mockRefetch = vi.fn();

vi.mock("../../hooks", () => ({
  useUserMe: () => ({
    data: { result: { externalAccounts: mockExternalAccounts } },
    refetch: mockRefetch,
    fetchStatus: "idle",
  }),
}));

vi.mock("@/utils/openRedditLogin", () => ({
  openRedditLogin: vi.fn(),
}));

const renderButton = (onConnected?: () => void) =>
  render(
    <ChakraProvider value={system}>
      <RedditLoginButton onConnected={onConnected} />
    </ChakraProvider>,
  );

describe("RedditLoginButton", () => {
  beforeEach(() => {
    mockExternalAccounts = undefined;
    mockRefetch.mockReset();
  });

  describe("onConnected callback", () => {
    it("fires onConnected when the reddit account is ACTIVE", () => {
      mockExternalAccounts = [{ type: "reddit", status: "ACTIVE" }];
      const onConnected = vi.fn();
      renderButton(onConnected);

      expect(onConnected).toHaveBeenCalledTimes(1);
    });

    it("does NOT fire onConnected when the reddit account is REVOKED", () => {
      // Regression: a revoked account record still exists, but it is not connected. Firing
      // onConnected here drove a retry that hit the server, got another 403, re-rendered, and
      // fired again - spamming the URL-validation endpoint with 403s.
      mockExternalAccounts = [{ type: "reddit", status: "REVOKED" }];
      const onConnected = vi.fn();
      renderButton(onConnected);

      expect(onConnected).not.toHaveBeenCalled();
    });

    it("does NOT fire onConnected when there is no reddit account", () => {
      mockExternalAccounts = undefined;
      const onConnected = vi.fn();
      renderButton(onConnected);

      expect(onConnected).not.toHaveBeenCalled();
    });
  });

  describe("button label", () => {
    it("shows Reconnect when a reddit account exists but is REVOKED", () => {
      mockExternalAccounts = [{ type: "reddit", status: "REVOKED" }];
      renderButton();

      expect(
        screen.getByRole("button", {
          name: "Reconnect Reddit in popup window",
        }),
      ).toBeInTheDocument();
    });

    it("shows Connect when there is no reddit account", () => {
      mockExternalAccounts = undefined;
      renderButton();

      expect(
        screen.getByRole("button", { name: "Connect Reddit in popup window" }),
      ).toBeInTheDocument();
    });
  });

  describe("workspace mode", () => {
    const renderWorkspaceButton = ({
      connectionStatus,
      onConnected,
      refresh = vi.fn(),
    }: {
      connectionStatus: "ACTIVE" | "REVOKED" | null;
      onConnected?: () => void;
      refresh?: () => void;
    }) =>
      render(
        <ChakraProvider value={system}>
          <RedditLoginButton
            onConnected={onConnected}
            workspace={{ id: "workspace-1", connectionStatus, refresh }}
          />
        </ChakraProvider>,
      );

    it("derives state from the WORKSPACE connection, not the personal account", () => {
      // Personal account is ACTIVE, but the workspace has no connection: the button must
      // offer Connect and must NOT fire onConnected (which would drive a stale retry).
      mockExternalAccounts = [{ type: "reddit", status: "ACTIVE" }];
      const onConnected = vi.fn();
      renderWorkspaceButton({ connectionStatus: null, onConnected });

      expect(
        screen.getByRole("button", { name: "Connect Reddit in popup window" }),
      ).toBeInTheDocument();
      expect(onConnected).not.toHaveBeenCalled();
    });

    it("fires onConnected when the workspace connection is ACTIVE", () => {
      mockExternalAccounts = undefined;
      const onConnected = vi.fn();
      renderWorkspaceButton({ connectionStatus: "ACTIVE", onConnected });

      expect(onConnected).toHaveBeenCalledTimes(1);
    });

    it("shows Reconnect when the workspace connection is REVOKED", () => {
      renderWorkspaceButton({ connectionStatus: "REVOKED" });

      expect(
        screen.getByRole("button", {
          name: "Reconnect Reddit in popup window",
        }),
      ).toBeInTheDocument();
    });

    it("opens the login popup scoped to the workspace", () => {
      renderWorkspaceButton({ connectionStatus: null });

      fireEvent.click(screen.getByRole("button", { name: "Connect Reddit in popup window" }));

      expect(openRedditLogin).toHaveBeenCalledWith("workspace-1");
    });

    it("refreshes the workspace connection (not the personal account) when the popup completes", () => {
      const refresh = vi.fn();
      renderWorkspaceButton({ connectionStatus: null, refresh });

      fireEvent(window, new MessageEvent("message", { data: "reddit" }));

      expect(refresh).toHaveBeenCalledTimes(1);
      expect(mockRefetch).not.toHaveBeenCalled();
    });
  });
});
