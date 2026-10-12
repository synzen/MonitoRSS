import type { ReactNode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider } from "@chakra-ui/react";
import { describe, it, expect, vi } from "vitest";
import { system } from "@/utils/theme";
import { DiscordMessageForm } from "./index";

const { mockConnection, mockUserFeed } = vi.hoisted(() => ({
  mockUserFeed: { id: "feed-1" },
  mockConnection: {
    id: "connection-1",
    key: "DISCORD_CHANNEL",
    splitOptions: null,
    mentions: undefined,
    customPlaceholders: undefined,
    details: {
      content: "original content",
      embeds: [],
      webhook: {
        id: "webhook-1",
        guildId: "guild-1",
        name: "Original Name",
        iconUrl: "https://example.com/original.png",
      },
    },
  },
}));

vi.mock("@/features/feed/contexts/UserFeedConnectionContext", () => ({
  useUserFeedConnectionContext: () => ({
    userFeed: mockUserFeed,
    connection: mockConnection,
    articleFormatOptions: {},
  }),
  UserFeedConnectionProvider: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("../../hooks/useSendTestArticleDirect", () => ({
  useSendTestArticleDirect: () => ({ isPending: false, mutateAsync: vi.fn() }),
}));

vi.mock("../../hooks/useConnection", () => ({
  useConnection: () => ({ connection: undefined }),
}));

vi.mock("./DiscordChannelConnectionPreview", () => ({
  DiscordChannelConnectionPreview: () => null,
}));

vi.mock("@/features/subscriptionProducts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/subscriptionProducts")>();

  return {
    ...actual,
    useIsFeatureAllowed: () => ({ loaded: true, allowed: true }),
  };
});

const renderForm = () => {
  const user = userEvent.setup();

  render(
    <ChakraProvider value={system}>
      <DiscordMessageForm onClickSave={vi.fn()} guildId={undefined} />
    </ChakraProvider>,
  );

  return { user };
};

describe("DiscordMessageForm discard", () => {
  it("restores message content and branding inputs, and clears dirty state", async () => {
    const { user } = renderForm();
    const contentInput = screen.getByLabelText("Text content");
    const displayNameInput = screen.getByPlaceholderText("e.g. Gaming News");

    // The preview badge tracks the same isDirty flag but is not wrapped in
    // AnimatePresence, so it unmounts immediately when the form goes clean.
    const UNSAVED_BADGE_TEXT = "You are previewing unsaved changes";

    expect(screen.queryByText(UNSAVED_BADGE_TEXT)).not.toBeInTheDocument();

    await user.type(contentInput, " edited");
    await user.clear(displayNameInput);
    await user.type(displayNameInput, "Edited Name");

    expect(screen.getByText("You have unsaved changes on this page!")).toBeInTheDocument();
    expect(screen.getByText(UNSAVED_BADGE_TEXT)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Discard all changes" }));

    // The form state is clean: fields revert and the dirty badge unmounts. The
    // popup bar itself is intentionally not asserted here — its AnimatePresence
    // exit animation never completes under happy-dom, so it stays mounted in
    // tests (in a real browser it animates away).
    await waitFor(() => expect(screen.queryByText(UNSAVED_BADGE_TEXT)).not.toBeInTheDocument());
    expect(contentInput).toHaveValue("original content");
    expect(displayNameInput).toHaveValue("Original Name");
  });
});
