import "@testing-library/jest-dom";
import { ChakraProvider } from "@chakra-ui/react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { system } from "@/utils/theme";
import { UserFeedComputedStatus } from "../../../types";
import { DEFAULT_COLUMN_VISIBILITY } from "../constants";
import { TableToolbar } from "./TableToolbar";

describe("TableToolbar", () => {
  it("selects compact rows from the current view menu", async () => {
    const user = userEvent.setup();
    const onCompactChange = vi.fn();

    render(
      <ChakraProvider value={system}>
        <TableToolbar
          searchInput=""
          onSearchInputChange={vi.fn()}
          onSearchSubmit={vi.fn()}
          onSearchClear={vi.fn()}
          search=""
          isFetching={false}
          statusFilters={[] as UserFeedComputedStatus[]}
          onStatusSelect={vi.fn()}
          columnVisibility={DEFAULT_COLUMN_VISIBILITY}
          onColumnVisibilityChange={vi.fn()}
          isCompact={false}
          onCompactChange={onCompactChange}
        />
      </ChakraProvider>,
    );

    const viewMenu = screen.getByRole("button", {
      name: "Feed table view: Regular",
    });

    await user.click(viewMenu);
    await user.click(screen.getByRole("menuitemradio", { name: "Compact rows" }));

    expect(onCompactChange).toHaveBeenCalledWith(true);
  });
});
