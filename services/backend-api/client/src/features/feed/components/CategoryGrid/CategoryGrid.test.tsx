import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
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
    </ChakraProvider>,
  );

  return { user, ...result };
};

describe("CategoryGrid", () => {
  it("renders all category radios plus Browse All", () => {
    renderGrid();
    const radios = screen.getAllByRole("radio");

    expect(radios).toHaveLength(categories.length + 1);
  });

  it("has a radiogroup container", () => {
    renderGrid();
    expect(screen.getByRole("radiogroup", { name: "Feed categories" })).toBeInTheDocument();
  });

  it("only the first radio has tabIndex 0", () => {
    renderGrid();
    const radios = screen.getAllByRole("radio");

    expect(radios[0]).toHaveAttribute("tabindex", "0");
    radios.slice(1).forEach((radio) => {
      expect(radio).toHaveAttribute("tabindex", "-1");
    });
  });

  it("ArrowRight moves focus to the next radio", async () => {
    const { user } = renderGrid();
    const radios = screen.getAllByRole("radio");

    radios[0].focus();
    await user.keyboard("{ArrowRight}");

    expect(radios[1]).toHaveFocus();
  });

  it("ArrowLeft from first wraps to last", async () => {
    const { user } = renderGrid();
    const radios = screen.getAllByRole("radio");

    radios[0].focus();
    await user.keyboard("{ArrowLeft}");

    expect(radios[radios.length - 1]).toHaveFocus();
  });

  it("ArrowRight from last wraps to first", async () => {
    const { user } = renderGrid();
    const radios = screen.getAllByRole("radio");

    radios[0].focus();
    for (let i = 0; i < radios.length; i++) {
      await user.keyboard("{ArrowRight}");
    }

    expect(radios[0]).toHaveFocus();
  });

  it("Home moves focus to first radio", async () => {
    const { user } = renderGrid();
    const radios = screen.getAllByRole("radio");

    radios[0].focus();
    await user.keyboard("{ArrowRight}{ArrowRight}");
    await user.keyboard("{Home}");

    expect(radios[0]).toHaveFocus();
  });

  it("End moves focus to last radio", async () => {
    const { user } = renderGrid();
    const radios = screen.getAllByRole("radio");

    radios[0].focus();
    await user.keyboard("{End}");

    expect(radios[radios.length - 1]).toHaveFocus();
  });

  it("clicking a category calls onSelectCategory with the category id", async () => {
    const onSelectCategory = vi.fn();
    const { user } = renderGrid({ onSelectCategory });

    await user.click(screen.getByRole("radio", { name: /^Gaming/ }));

    expect(onSelectCategory).toHaveBeenCalledWith("gaming");
  });

  it("clicking Browse All calls onSelectCategory with undefined", async () => {
    const onSelectCategory = vi.fn();
    const { user } = renderGrid({ onSelectCategory });

    await user.click(screen.getByText("Browse All Categories").closest("[role='radio']")!);

    expect(onSelectCategory).toHaveBeenCalledWith(undefined);
  });

  it("shows total feed count in Browse All card", () => {
    renderGrid({ totalFeedCount: 123 });

    expect(screen.getByText(/123 popular feeds to explore/)).toBeInTheDocument();
  });
});
