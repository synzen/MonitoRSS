import "@testing-library/jest-dom";
import { ChakraProvider } from "@chakra-ui/react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { system } from "@/utils/theme";
import { PaginationSection } from "./PaginationSection";

describe("PaginationSection", () => {
  it("reports the current range and provides direct, keyboard-accessible page controls", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    const onPageSizeChange = vi.fn();

    render(
      <ChakraProvider value={system}>
        <PaginationSection
          page={3}
          pageSize={50}
          totalCount={1100}
          isFetching={false}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      </ChakraProvider>,
    );

    expect(screen.getByText("101–150 of 1,100 feeds")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous page" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Next page" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "Page 22" }));
    await user.selectOptions(screen.getByLabelText("Feeds per page"), "100");

    expect(onPageChange).toHaveBeenCalledWith(22);
    expect(onPageSizeChange).toHaveBeenCalledWith(100);
    expect(screen.getByRole("button", { name: "Page 3" })).toHaveAttribute("aria-current", "page");
  });

  it("disables navigation at the page boundaries", () => {
    render(
      <ChakraProvider value={system}>
        <PaginationSection
          page={1}
          pageSize={50}
          totalCount={20}
          isFetching={false}
          onPageChange={vi.fn()}
          onPageSizeChange={vi.fn()}
        />
      </ChakraProvider>,
    );

    expect(screen.getByRole("button", { name: "Previous page" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
  });
});
