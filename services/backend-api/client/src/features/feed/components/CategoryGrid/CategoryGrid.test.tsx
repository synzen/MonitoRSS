import "@testing-library/jest-dom";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider } from "@chakra-ui/react";
import { describe, it, expect, vi } from "vitest";
import { CategoryGrid } from ".";

const categories = [
  { id: "gaming", label: "Gaming" },
  { id: "tech", label: "Tech" },
  { id: "news", label: "News" },
  { id: "sports", label: "Sports" },
];

const defaultProps = {
  categories,
  totalFeedCount: 50,
  getCategoryPreviewText: (id: string) => `Preview for ${id}`,
  onSelectCategory: vi.fn(),
};

const renderGrid = (overrides = {}) => {
  const user = userEvent.setup();
  const props = { ...defaultProps, ...overrides };
  const result = render(
    <ChakraProvider>
      <CategoryGrid {...props} />
    </ChakraProvider>
  );

  return { user, ...result };
};

describe("CategoryGrid", () => {
  it("renders all category buttons plus Browse All", () => {
    renderGrid();
    const list = screen.getByRole("list", { name: "Feed categories" });
    const items = within(list).getAllByRole("listitem");

    expect(items).toHaveLength(categories.length + 1);
  });

  it("only the first button has tabIndex 0", () => {
    renderGrid();
    const buttons = screen.getAllByRole("button");

    expect(buttons[0]).toHaveAttribute("tabindex", "0");
    buttons.slice(1).forEach((btn) => {
      expect(btn).toHaveAttribute("tabindex", "-1");
    });
  });

  it("ArrowRight moves focus to the next button", async () => {
    const { user } = renderGrid();
    const buttons = screen.getAllByRole("button");

    buttons[0].focus();
    await user.keyboard("{ArrowRight}");

    expect(buttons[1]).toHaveFocus();
  });

  it("ArrowLeft from first wraps to last", async () => {
    const { user } = renderGrid();
    const buttons = screen.getAllByRole("button");

    buttons[0].focus();
    await user.keyboard("{ArrowLeft}");

    expect(buttons[buttons.length - 1]).toHaveFocus();
  });

  it("ArrowRight from last wraps to first", async () => {
    const { user } = renderGrid();
    const buttons = screen.getAllByRole("button");

    buttons[0].focus();
    for (let i = 0; i < buttons.length; i++) {
      await user.keyboard("{ArrowRight}");
    }

    expect(buttons[0]).toHaveFocus();
  });

  it("Home moves focus to first button", async () => {
    const { user } = renderGrid();
    const buttons = screen.getAllByRole("button");

    buttons[0].focus();
    await user.keyboard("{ArrowRight}{ArrowRight}");
    await user.keyboard("{Home}");

    expect(buttons[0]).toHaveFocus();
  });

  it("End moves focus to last button", async () => {
    const { user } = renderGrid();
    const buttons = screen.getAllByRole("button");

    buttons[0].focus();
    await user.keyboard("{End}");

    expect(buttons[buttons.length - 1]).toHaveFocus();
  });

  it("clicking a category calls onSelectCategory with the category id", async () => {
    const onSelectCategory = vi.fn();
    const { user } = renderGrid({ onSelectCategory });

    await user.click(screen.getByRole("button", { name: /^Gaming/ }));

    expect(onSelectCategory).toHaveBeenCalledWith("gaming");
  });

  it("clicking Browse All calls onSelectCategory with undefined", async () => {
    const onSelectCategory = vi.fn();
    const { user } = renderGrid({ onSelectCategory });

    await user.click(screen.getByText("Browse All").closest("button")!);

    expect(onSelectCategory).toHaveBeenCalledWith(undefined);
  });

  it("shows total feed count in Browse All card", () => {
    renderGrid({ totalFeedCount: 123 });

    expect(screen.getByText(/See all 123 feeds/)).toBeInTheDocument();
  });
});
