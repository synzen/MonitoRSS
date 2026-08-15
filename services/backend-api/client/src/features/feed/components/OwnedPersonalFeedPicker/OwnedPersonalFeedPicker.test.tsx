import "@testing-library/jest-dom";
import { ChakraProvider } from "@chakra-ui/react";
import { render, screen } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { system } from "@/utils/theme";
import { useOwnedPersonalFeeds } from "../../hooks/useOwnedPersonalFeeds";
import {
  OwnedPersonalFeedPicker,
  type OwnedPersonalFeedPickerCopy,
} from "./OwnedPersonalFeedPicker";

vi.mock("../../hooks/useOwnedPersonalFeeds", () => ({
  useOwnedPersonalFeeds: vi.fn(),
}));

const standaloneCopy: Partial<OwnedPersonalFeedPickerCopy> = {
  legend: "Personal feeds to move into Acme",
  capacityFull: "Workspace full",
  autoPickDirectionLabel: "Which feeds to move when they do not all fit",
  autoPickLead: "Move my",
  unselectedPlain: "Remains personal",
};

const Harness = () => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  return (
    <ChakraProvider value={system}>
      <OwnedPersonalFeedPicker
        selectedIds={selectedIds}
        onSelectedIdsChange={setSelectedIds}
        allowance={1}
        copy={standaloneCopy}
      />
    </ChakraProvider>
  );
};

describe("OwnedPersonalFeedPicker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useOwnedPersonalFeeds).mockReturnValue({
      data: {
        pages: [
          {
            total: 2,
            results: [
              { id: "feed-1", title: "First feed" },
              { id: "feed-2", title: "Second feed" },
            ],
          },
        ],
      },
      status: "success",
      error: null,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      setSearch: vi.fn(),
      isFetching: false,
      search: "",
      getByAge: vi.fn(),
    } as never);
  });

  it("uses host wording without inheriting plan-conversion copy", async () => {
    render(<Harness />);

    expect(
      await screen.findByRole("group", {
        name: "Personal feeds to move into Acme",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Move my")).toBeVisible();
    expect(screen.getByLabelText("Which feeds to move when they do not all fit")).toBeVisible();
    expect(screen.getAllByText("Remains personal")).toHaveLength(2);
    expect(screen.queryByText(/plan full/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/stays on your personal plan/i)).not.toBeInTheDocument();
  });

  it("keeps host labels associated when more than one picker is mounted", async () => {
    render(
      <>
        <Harness />
        <Harness />
      </>,
    );

    const selectors = await screen.findAllByLabelText(
      "Which feeds to move when they do not all fit",
    );
    expect(new Set(selectors.map((selector) => selector.id)).size).toBe(2);
  });
});
