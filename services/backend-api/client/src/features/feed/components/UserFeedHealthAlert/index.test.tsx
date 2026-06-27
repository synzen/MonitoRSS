import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { ChakraProvider } from "@chakra-ui/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { system } from "@/utils/theme";
import { UserFeedHealthAlert } from "./index";
import { UserFeedDisabledCode } from "../../types";

const { mockUserFeed, mockRequestsReturn } = vi.hoisted(() => ({
  mockUserFeed: vi.fn(),
  mockRequestsReturn: vi.fn(),
}));

vi.mock("../../contexts/UserFeedContext", () => ({
  useUserFeedContext: () => ({ userFeed: mockUserFeed() }),
}));

vi.mock("../../hooks", async () => ({
  ...(await vi.importActual<Record<string, unknown>>("../../hooks")),
  useUserFeedRequestsWithPagination: () => mockRequestsReturn(),
  useCreateUserFeedManualRequest: () => ({ mutateAsync: vi.fn(), status: "idle" }),
}));

const failingRequestsReturn = {
  status: "success",
  data: {
    result: {
      requests: [
        {
          id: "req-1",
          status: "FETCH_ERROR",
          createdAt: new Date().toISOString(),
          response: { statusCode: 500 },
        },
      ],
      nextRetryAtIso: new Date().toISOString(),
    },
  },
};

const baseUserFeed = {
  id: "feed-1",
  url: "https://example.com/feed.xml",
  refreshRateSeconds: 600,
};

const renderComponent = () =>
  render(
    <ChakraProvider value={system}>
      <MemoryRouter>
        <UserFeedHealthAlert />
      </MemoryRouter>
    </ChakraProvider>,
  );

describe("UserFeedHealthAlert", () => {
  it("shows the failing-requests warning for an enabled feed with failing requests", () => {
    mockRequestsReturn.mockReturnValue(failingRequestsReturn);
    mockUserFeed.mockReturnValue(baseUserFeed);

    renderComponent();

    expect(screen.getByText("Requests are currently failing")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry feed request" })).toBeInTheDocument();
  });

  // A disabled feed is not polled, so the warning (and its retry CTA) would be
  // misleading regardless of WHY it was disabled; the disabled alert is the sole banner.
  it.each(Object.values(UserFeedDisabledCode))(
    "renders nothing when the feed is disabled with code %s despite failing requests",
    (disabledCode) => {
      mockRequestsReturn.mockReturnValue(failingRequestsReturn);
      mockUserFeed.mockReturnValue({ ...baseUserFeed, disabledCode });

      renderComponent();

      expect(screen.queryByText("Requests are currently failing")).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Retry feed request" })).not.toBeInTheDocument();
    },
  );

  it("renders nothing when the latest request succeeded", () => {
    mockRequestsReturn.mockReturnValue({
      status: "success",
      data: {
        result: {
          requests: [
            {
              id: "req-1",
              status: "OK",
              createdAt: new Date().toISOString(),
              response: { statusCode: 200 },
            },
          ],
          nextRetryAtIso: null,
        },
      },
    });
    mockUserFeed.mockReturnValue(baseUserFeed);

    renderComponent();

    expect(screen.queryByText("Requests are currently failing")).not.toBeInTheDocument();
  });
});
