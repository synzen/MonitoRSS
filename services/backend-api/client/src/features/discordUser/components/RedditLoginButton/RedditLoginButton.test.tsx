import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { ChakraProvider } from "@chakra-ui/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { system } from "@/utils/theme";
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
});
