import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider } from "@chakra-ui/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { system } from "@/utils/theme";
import { ConvertPersonalPlanDialog } from "./ConvertPersonalPlanDialog";
import { useUserFeedsInfinite } from "../../../feed/hooks/useUserFeedsInfinite";

vi.mock("../../../feed/hooks/useUserFeedsInfinite", () => ({
  useUserFeedsInfinite: vi.fn(),
}));

vi.mock("../../../feed/api", () => ({
  getUserFeeds: vi.fn(),
}));

vi.mock("../../hooks", () => ({
  useConvertWorkspaceBilling: () => ({
    mutateAsync: vi.fn(),
    error: null,
  }),
}));

const installNoFeeds = () => {
  vi.mocked(useUserFeedsInfinite).mockImplementation(
    () =>
      ({
        data: { pages: [{ total: 0, results: [] }] },
        status: "success",
        error: null,
        fetchNextPage: vi.fn(),
        isFetching: false,
        setSearch: vi.fn(),
        hasNextPage: false,
        isFetchingNextPage: false,
        search: "",
      }) as never,
  );
};

const renderDialog = () =>
  render(
    <MemoryRouter>
      <ChakraProvider value={system}>
        <ConvertPersonalPlanDialog
          open
          onClose={vi.fn()}
          onConverted={vi.fn()}
          workspaceSlug="acme-team"
          feedLimit={70}
          workspaceHasActiveRedditGrant={false}
        />
      </ChakraProvider>
    </MemoryRouter>,
  );

describe("ConvertPersonalPlanDialog with no personal feeds", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps the move-plan action enabled when the owner has no feeds to bring", async () => {
    installNoFeeds();

    renderDialog();

    await screen.findByText(/Move your personal plan to this workspace/i);

    // Type the required confirmation phrase; the only remaining gate on the
    // button should be that phrase, NOT an empty (zero-feed) selection.
    const phraseInput = screen.getByRole("textbox");
    await userEvent.type(phraseInput, "acme-team");

    const moveButton = screen.getByRole("button", { name: /move plan/i });
    await waitFor(() => expect(moveButton).not.toHaveAttribute("aria-disabled", "true"));
  });
});
