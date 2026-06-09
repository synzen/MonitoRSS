import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { ChakraProvider } from "@chakra-ui/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { system } from "@/utils/theme";
import { RedditConnectionSetting } from "./RedditConnectionSetting";

let mockExternalAccounts: Array<{ type: string; status: string }> | undefined;

vi.mock("@/features/discordUser", () => ({
  useUserMe: () => ({
    data: { result: { externalAccounts: mockExternalAccounts } },
    refetch: vi.fn(),
    fetchStatus: "idle",
  }),
  RedditLoginButton: () => <button type="button">reddit-login</button>,
}));

vi.mock("../../hooks/useRemoveRedditLogin", () => ({
  useRemoveRedditLogin: () => ({ mutateAsync: vi.fn(), status: "idle" }),
}));

const renderSetting = () =>
  render(
    <ChakraProvider value={system}>
      <RedditConnectionSetting />
    </ChakraProvider>,
  );

describe("RedditConnectionSetting", () => {
  beforeEach(() => {
    mockExternalAccounts = undefined;
  });

  it("shows Connected when the reddit account is ACTIVE", () => {
    mockExternalAccounts = [{ type: "reddit", status: "ACTIVE" }];
    renderSetting();

    expect(screen.getByText("Connected")).toBeInTheDocument();
    expect(screen.queryByText("Not Connected")).not.toBeInTheDocument();
    // Disconnect is offered for an active connection.
    expect(
      screen.getByRole("button", { name: /disconnect/i }),
    ).toBeInTheDocument();
  });

  it("shows a Disconnected state (not Connected) when the reddit account is REVOKED", () => {
    // The user can revoke MonitoRSS's access from Reddit's side; the settings page must reflect
    // that the connection is no longer usable rather than showing a green "Connected" badge.
    mockExternalAccounts = [{ type: "reddit", status: "REVOKED" }];
    renderSetting();

    expect(screen.getByText("Disconnected")).toBeInTheDocument();
    expect(screen.queryByText("Connected")).not.toBeInTheDocument();
  });

  it("shows Not Connected when there is no reddit account", () => {
    mockExternalAccounts = undefined;
    renderSetting();

    expect(screen.getByText("Not Connected")).toBeInTheDocument();
  });
});
