import "@testing-library/jest-dom";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider } from "@chakra-ui/react";
import { MemoryRouter } from "react-router-dom";
import { useState } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { system } from "@/utils/theme";
import ApiAdapterError from "@/utils/ApiAdapterError";
import { ApiErrorCode } from "@/utils/getStandardErrorCodeMessage";
import { EditUserFeedDialog } from "./index";

// Regression test for the missing Reddit connect gate when EDITING an existing feed's URL.
// Previously the dialog flattened the error to a string and only rendered a plain alert, so a
// REDDIT_CONNECTION_REQUIRED response on update showed a bare error instead of the connect CTA.
// This exercises the real FixFeedRequestsCTA + RedditLoginButton wiring:
// changing the URL to a subreddit shows the gate; after connecting, the retry must succeed and close.
// Only the leaf useUserMe hook, the validation hook, and the OAuth popup are mocked.

const redditError = new ApiAdapterError("Reddit connection required", {
  errorCode: ApiErrorCode.REDDIT_CONNECTION_REQUIRED,
  statusCode: 403,
});

// When set, the validation mock resolves the submitted URL to this value (mimicking
// the real subreddit -> authenticated-feed substitution), which exercises the
// confirm-step path. Default null = already-valid, so onSubmit proceeds to onUpdate.
let resolvedToUrl: string | null = null;

// Stateful validation mock: returns a non-resolving (already-valid) result so onSubmit proceeds
// straight to onUpdate, which is where the gate is enforced in this test.
vi.mock("../../hooks/useCreateUserFeedUrlValidation", () => ({
  useCreateUserFeedUrlValidation: () => {
    const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
    const [data, setData] = useState<{ result: { resolvedToUrl: string | null } } | undefined>(
      undefined,
    );

    return {
      status,
      error: null,
      data,
      reset: () => {
        setStatus("idle");
        setData(undefined);
      },
      mutateAsync: async () => {
        setStatus("loading");
        await Promise.resolve();
        setStatus("success");
        const result = { result: { resolvedToUrl } };
        // Mirror the real hook, which exposes the result via `data` so the dialog's
        // confirm step (gated on feedUrlValidationData) can render.
        setData(result);

        return result;
      },
    };
  },
}));

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

const renderDialog = (
  onUpdate: (data: { title?: string; url?: string }) => Promise<void>,
  error: ApiAdapterError | null = null,
) => {
  const user = userEvent.setup();
  const result = render(
    <ChakraProvider value={system}>
      <MemoryRouter>
        <EditUserFeedDialog
          isOpen
          onClose={vi.fn()}
          onUpdate={onUpdate}
          defaultValues={{
            title: "Existing title",
            url: "https://example.com/feed.xml",
          }}
          error={error}
        />
      </MemoryRouter>
    </ChakraProvider>,
  );

  return { user, ...result };
};

describe("EditUserFeedDialog - Reddit connect gate", () => {
  beforeEach(() => {
    redditAccount = undefined;
    resolvedToUrl = null;
    userMeListeners.clear();
  });

  it("shows the connect gate when updating to a subreddit URL fails with REDDIT_CONNECTION_REQUIRED", async () => {
    // The first update attempt rejects with the gate error; the parent feeds that error back in via
    // a re-render. Here we simulate that by rendering with the error already present.
    const onUpdate = vi.fn().mockRejectedValueOnce(redditError);
    const { user, rerender } = renderDialog(onUpdate);

    const urlInput = screen.getByDisplayValue("https://example.com/feed.xml");
    await user.clear(urlInput);
    await user.type(urlInput, "https://www.reddit.com/r/gaming");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onUpdate).toHaveBeenCalled());

    // Parent re-renders with the gate error surfaced.
    rerender(
      <ChakraProvider value={system}>
        <MemoryRouter>
          <EditUserFeedDialog
            isOpen
            onClose={vi.fn()}
            onUpdate={onUpdate}
            defaultValues={{
              title: "Existing title",
              url: "https://example.com/feed.xml",
            }}
            error={redditError}
          />
        </MemoryRouter>
      </ChakraProvider>,
    );

    expect(await screen.findByText("Connect your Reddit account to continue")).toBeInTheDocument();
  });

  it("does not render the gate for a generic (non-reddit) error", () => {
    const onUpdate = vi.fn();
    renderDialog(
      onUpdate,
      new ApiAdapterError("Something went wrong", {
        errorCode: ApiErrorCode.FEED_LIMIT_REACHED,
        statusCode: 400,
      }),
    );

    expect(screen.queryByText("Connect your Reddit account to continue")).not.toBeInTheDocument();
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("shows the reconnect gate and does NOT auto-retry when the reddit account is REVOKED", async () => {
    // A revoked account record exists but is not active. The dialog must surface the connect gate
    // with reconnect copy and must NOT auto-fire the update (which would re-hit the 403 server-side
    // gate and spam it). The retry only runs on the not-connected -> ACTIVE edge.
    redditAccount = { type: "reddit", status: "REVOKED" };
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    const user = userEvent.setup();
    render(
      <ChakraProvider value={system}>
        <MemoryRouter>
          <EditUserFeedDialog
            isOpen
            onClose={onClose}
            onUpdate={onUpdate}
            defaultValues={{
              title: "Existing title",
              url: "https://example.com/feed.xml",
            }}
            error={redditError}
          />
        </MemoryRouter>
      </ChakraProvider>,
    );

    const urlInput = screen.getByDisplayValue("https://example.com/feed.xml");
    await user.clear(urlInput);
    await user.type(urlInput, "https://www.reddit.com/r/gaming");

    expect(await screen.findByText("Reconnect your Reddit account")).toBeInTheDocument();

    // No connect event has fired, so the blocked update must not have been retried.
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
    expect(onUpdate).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("retries the update and closes after connecting Reddit", async () => {
    const onClose = vi.fn();
    // The initial gate failure is simulated via the `error` prop; the post-connect retry resolves.
    const onUpdate = vi.fn().mockResolvedValue(undefined);

    const user = userEvent.setup();
    render(
      <ChakraProvider value={system}>
        <MemoryRouter>
          <EditUserFeedDialog
            isOpen
            onClose={onClose}
            onUpdate={onUpdate}
            defaultValues={{
              title: "Existing title",
              url: "https://example.com/feed.xml",
            }}
            error={redditError}
          />
        </MemoryRouter>
      </ChakraProvider>,
    );

    // Make the form dirty so the retry's onSubmit runs onUpdate (rather than early-returning).
    const urlInput = screen.getByDisplayValue("https://example.com/feed.xml");
    await user.clear(urlInput);
    await user.type(urlInput, "https://www.reddit.com/r/gaming");

    expect(await screen.findByText("Connect your Reddit account to continue")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Connect Reddit in popup window" }));

    await act(async () => {
      window.postMessage("reddit", "*");
      await new Promise((resolve) => {
        setTimeout(resolve, 0);
      });
    });

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ url: "https://www.reddit.com/r/gaming" }),
    );
  });

  it("saves directly (skipping the confirm step) on the post-connect retry, even for a resolving URL", async () => {
    // A subreddit URL would resolve during the dialog's own pre-validation, normally
    // pausing on a confirm step. The post-connect retry must skip that pre-flight and
    // save the entered URL directly (the server resolves it and re-checks the now
    // satisfied gate), so the dialog closes instead of stranding on confirm. The
    // resolving mock would force the confirm step if pre-validation still ran.
    resolvedToUrl = "https://www.reddit.com/r/gaming.rss?auth=1";
    const onClose = vi.fn();
    const onUpdate = vi.fn().mockResolvedValue(undefined);

    const user = userEvent.setup();
    render(
      <ChakraProvider value={system}>
        <MemoryRouter>
          <EditUserFeedDialog
            isOpen
            onClose={onClose}
            onUpdate={onUpdate}
            defaultValues={{
              title: "Existing title",
              url: "https://example.com/feed.xml",
            }}
            error={redditError}
          />
        </MemoryRouter>
      </ChakraProvider>,
    );

    const urlInput = screen.getByDisplayValue("https://example.com/feed.xml");
    await user.clear(urlInput);
    await user.type(urlInput, "https://www.reddit.com/r/gaming");

    expect(await screen.findByText("Connect your Reddit account to continue")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Connect Reddit in popup window" }));

    await act(async () => {
      window.postMessage("reddit", "*");
      await new Promise((resolve) => {
        setTimeout(resolve, 0);
      });
    });

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    // Saved with the entered URL (server does the resolution), not the confirm step.
    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ url: "https://www.reddit.com/r/gaming" }),
    );
  });

  it("still pauses on the confirm step for a normal (non-retry) resolved URL", async () => {
    // Without a connect retry, a resolving URL must NOT auto-save: the manual confirm
    // step is preserved so the user sees and confirms the substituted URL.
    resolvedToUrl = "https://www.reddit.com/r/gaming.rss?auth=1";
    const onClose = vi.fn();
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    // Connected from the start, so no gate and no auto-retry: a plain edit + Save.
    redditAccount = { type: "reddit", status: "ACTIVE" };

    const user = userEvent.setup();
    render(
      <ChakraProvider value={system}>
        <MemoryRouter>
          <EditUserFeedDialog
            isOpen
            onClose={onClose}
            onUpdate={onUpdate}
            defaultValues={{
              title: "Existing title",
              url: "https://example.com/feed.xml",
            }}
            error={null}
          />
        </MemoryRouter>
      </ChakraProvider>,
    );

    const urlInput = screen.getByDisplayValue("https://example.com/feed.xml");
    await user.clear(urlInput);
    await user.type(urlInput, "https://www.reddit.com/r/gaming");
    await user.click(screen.getByRole("button", { name: "Save" }));

    // The first Save resolves the URL and pauses on confirm: no save, no close.
    await waitFor(() =>
      expect(screen.getByText("https://www.reddit.com/r/gaming.rss?auth=1")).toBeInTheDocument(),
    );
    expect(onUpdate).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
