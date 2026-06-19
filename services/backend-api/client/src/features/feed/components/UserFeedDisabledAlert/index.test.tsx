import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { ChakraProvider } from "@chakra-ui/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { system } from "@/utils/theme";
import { UserFeedDisabledAlert } from "./index";
import { UserFeedDisabledCode } from "../../types";

const { mockUserFeed, mockFeedScope } = vi.hoisted(() => ({
  mockUserFeed: vi.fn(),
  mockFeedScope: vi.fn(),
}));

vi.mock("../../contexts/UserFeedContext", () => ({
  useUserFeedContext: () => ({ userFeed: mockUserFeed() }),
}));

vi.mock("../../contexts/FeedScopeContext", () => ({
  useFeedScope: () => mockFeedScope(),
}));

vi.mock("../../hooks", async () => ({
  ...(await vi.importActual<Record<string, unknown>>("../../hooks")),
  useUpdateUserFeed: () => ({ mutateAsync: vi.fn(), status: "idle" }),
  useCreateUserFeedManualRequest: () => ({ mutateAsync: vi.fn(), status: "idle" }),
}));

vi.mock("../../../../contexts/PageAlertContext", () => ({
  usePageAlertContext: () => ({
    createErrorAlert: vi.fn(),
    createSuccessAlert: vi.fn(),
    createInfoAlert: vi.fn(),
  }),
}));

const baseUserFeed = {
  id: "feed-1",
  url: "https://example.com/feed.xml",
  refreshRateSeconds: 600,
  disabledCode: UserFeedDisabledCode.FailedRequests,
};

const renderComponent = () =>
  render(
    <ChakraProvider value={system}>
      <MemoryRouter>
        <UserFeedDisabledAlert />
      </MemoryRouter>
    </ChakraProvider>,
  );

describe("UserFeedDisabledAlert", () => {
  // A dormant workspace (feed limit 0) rejects every re-enable, so the retry
  // button would be a guaranteed dead end; the subscription requirement is
  // explained instead.
  it("replaces the re-enable button with the subscription explanation in a dormant workspace", () => {
    mockUserFeed.mockReturnValue({ ...baseUserFeed, isWorkspaceFeed: true });
    mockFeedScope.mockReturnValue({ workspaceDormant: true });

    renderComponent();

    expect(screen.queryByRole("button", { name: /Attempt to re-enable/ })).not.toBeInTheDocument();
    expect(
      screen.getByText(/can't be re-enabled because the workspace is not subscribed/),
    ).toBeInTheDocument();
  });

  it("shows the re-enable button for a workspace feed when the workspace is subscribed", () => {
    mockUserFeed.mockReturnValue({ ...baseUserFeed, isWorkspaceFeed: true });
    mockFeedScope.mockReturnValue({ workspaceDormant: false });

    renderComponent();

    expect(screen.getByRole("button", { name: /Attempt to re-enable/ })).toBeInTheDocument();
  });

  it("shows the re-enable button for a personal feed", () => {
    mockUserFeed.mockReturnValue({ ...baseUserFeed, isWorkspaceFeed: false });
    mockFeedScope.mockReturnValue({});

    renderComponent();

    expect(screen.getByRole("button", { name: /Attempt to re-enable/ })).toBeInTheDocument();
  });
});
