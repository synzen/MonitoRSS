import "@testing-library/jest-dom";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider } from "@chakra-ui/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { useState } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { system } from "@/utils/theme";
import ApiAdapterError from "@/utils/ApiAdapterError";
import { ApiErrorCode } from "@/utils/getStandardErrorCodeMessage copy";
import { BrowseFeedsModal } from "./index";

// Regression test for the Reddit connect retry in the discovery modal: pasting a subreddit URL
// without a connection shows the connect gate; after connecting, the re-validation must render
// the resulting feed card (with an Add button) in place of the gate.
//
// Uses the REAL RedditLoginButton + FixFeedRequestsCTA so the actual connect -> onConnected ->
// retry wiring is exercised (the bug lived in that wiring + the modal's remounting results key).
// Only the leaf useUserMe hook and the OAuth popup are mocked.

const mockCategories = [{ id: "gaming", label: "Gaming", count: 0 }];

vi.mock("../../hooks", () => ({
  useCuratedFeeds: () => ({
    data: { feeds: [], categories: mockCategories },
    getHighlightFeeds: () => [],
    getCategoryPreviewText: () => "",
    isLoading: false,
    isFetching: false,
    error: null,
    refetch: vi.fn(),
  }),
  useUserFeeds: () => ({ data: { total: 1 }, status: "success", error: null }),
  useCreateUserFeed: () => ({
    mutateAsync: vi.fn().mockResolvedValue({ result: { id: "new-feed-id" } }),
  }),
}));

vi.mock("../../hooks/useDeleteUserFeed", () => ({
  useDeleteUserFeed: () => ({
    mutateAsync: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock("../../hooks/useCuratedFeedPreview", () => ({
  useCuratedFeedPreview: () => ({
    mutateAsync: vi.fn(),
    status: "idle",
    error: null,
    reset: vi.fn(),
    data: undefined,
  }),
}));

// Stateful validation mock: the first submit errors with REDDIT_CONNECTION_REQUIRED; after reset()
// (driven by the retry) the next submit resolves successfully. Backed by real React state so the
// consuming components re-render on each transition, faithfully reproducing the lifecycle. The
// async boundary (await before resolving) mirrors a real network call, so the modal's remounting
// key has a chance to tear down the in-flight retry.
let validationCallCount = 0;

const redditError = new ApiAdapterError("Reddit connection required", {
  errorCode: ApiErrorCode.REDDIT_CONNECTION_REQUIRED,
  statusCode: 403,
});

vi.mock("../../hooks/useCreateUserFeedUrlValidation", () => ({
  useCreateUserFeedUrlValidation: () => {
    const [status, setStatus] = useState<
      "idle" | "loading" | "success" | "error"
    >("idle");
    const [error, setError] = useState<ApiAdapterError | null>(null);
    const [data, setData] = useState<
      { result: { feedTitle?: string } } | undefined
    >(undefined);

    return {
      status,
      error,
      data,
      reset: () => {
        setStatus("idle");
        setError(null);
        setData(undefined);
      },
      mutateAsync: async () => {
        validationCallCount += 1;
        const isFirstCall = validationCallCount === 1;
        setStatus("loading");
        await Promise.resolve();

        if (isFirstCall) {
          setStatus("error");
          setError(redditError);
          throw redditError;
        }

        const result = { result: { feedTitle: "HolyShitHistory" } };
        setStatus("success");
        setData(result);
        setError(null);

        return result;
      },
    };
  },
}));

// Leaf useUserMe mock: starts with no Reddit account (gate shows). refetch() flips the account to
// ACTIVE and re-renders, mirroring the real popup -> postMessage -> refetch flow. The real
// RedditLoginButton's effect then fires onConnected (the retry trigger).
let redditAccount: { type: string; status: string } | undefined;
const userMeListeners = new Set<() => void>();

vi.mock("@/features/discordUser/hooks/useUserMe", () => ({
  useUserMe: () => {
    const [, forceRender] = useState(0);
    userMeListeners.add(() => forceRender((n) => n + 1));

    return {
      data: {
        result: {
          externalAccounts: redditAccount ? [redditAccount] : undefined,
        },
      },
      error: null,
      status: "success",
      fetchStatus: "idle",
      refetch: async () => {
        redditAccount = { type: "reddit", status: "ACTIVE" };
        userMeListeners.forEach((notify) => notify());

        return { data: undefined };
      },
    };
  },
}));

vi.mock("@/utils/openRedditLogin", () => ({
  openRedditLogin: vi.fn(),
}));

// Mock the leaf useDiscordUserMe (FeedLimitBar dependency) so both discordUser barrels transparently
// re-export it alongside the mocked leaf useUserMe.
vi.mock("@/features/discordUser/hooks/useDiscordUserMe", () => ({
  useDiscordUserMe: () => ({
    data: { result: { maxUserFeeds: 50 } },
    status: "success",
    error: null,
  }),
}));

const renderModal = () => {
  const user = userEvent.setup();
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const result = render(
    <QueryClientProvider client={queryClient}>
      <ChakraProvider value={system}>
        <MemoryRouter>
          <BrowseFeedsModal
            isOpen
            onClose={vi.fn()}
            feedActionStates={{}}
            isAtLimit={false}
            onAdd={vi.fn()}
            onFeedAdded={vi.fn()}
            onFeedRemoved={vi.fn()}
          />
        </MemoryRouter>
      </ChakraProvider>
    </QueryClientProvider>,
  );

  return { user, ...result };
};

describe("BrowseFeedsModal - Reddit connect retry", () => {
  beforeEach(() => {
    validationCallCount = 0;
    redditAccount = undefined;
    userMeListeners.clear();
  });

  it("renders the validated feed card after connecting Reddit, replacing the gate", async () => {
    const { user } = renderModal();

    const input = await screen.findByLabelText(
      "Search popular feeds or paste a URL",
    );
    await user.type(input, "https://www.reddit.com/r/HolyShitHistory");
    await user.click(screen.getByRole("button", { name: "Go", exact: true }));

    // The mandatory-connection gate is shown in place of a feed card.
    expect(
      await screen.findByText("Connect your Reddit account to continue"),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Connect Reddit in popup window" }),
    );

    // Simulate the OAuth popup completing: it posts "reddit" back, which the button listens for and
    // turns into a useUserMe refetch (now resolving to an ACTIVE connection).
    await act(async () => {
      window.postMessage("reddit", "*");
      await new Promise((resolve) => {
        setTimeout(resolve, 0);
      });
    });

    // After connecting, the retry must re-validate and render the feed card with an Add button.
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Add HolyShitHistory feed" }),
      ).toBeInTheDocument();
    });

    // The gate is gone.
    expect(
      screen.queryByText("Connect your Reddit account to continue"),
    ).not.toBeInTheDocument();
  });
});
