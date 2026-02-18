import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider } from "@chakra-ui/react";
import { describe, it, expect, vi } from "vitest";
import { CategoryPills } from "./index";

const mockCategories = [
  { id: "gaming", label: "Gaming", count: 3 },
  { id: "tech", label: "Tech", count: 2 },
  { id: "news", label: "News", count: 5 },
];

const renderPills = (props: Partial<React.ComponentProps<typeof CategoryPills>> = {}) => {
  const user = userEvent.setup();

  const result = render(
    <ChakraProvider>
      <CategoryPills
        categories={mockCategories}
        selectedCategory={undefined}
        onSelect={() => {}}
        {...props}
      />
    </ChakraProvider>
  );

  return { user, ...result };
};

describe("CategoryPills", () => {
  describe("Rendering", () => {
    it("renders all category pills including All", () => {
      renderPills();

      expect(screen.getByText("All")).toBeInTheDocument();
      expect(screen.getByText("Gaming")).toBeInTheDocument();
      expect(screen.getByText("Tech")).toBeInTheDocument();
      expect(screen.getByText("News")).toBeInTheDocument();
    });

    it("selected pill has aria-checked true", () => {
      renderPills({ selectedCategory: "gaming" });

      expect(screen.getByText("Gaming").closest("[role='radio']")).toHaveAttribute(
        "aria-checked",
        "true"
      );
    });

    it("unselected pills have aria-checked false", () => {
      renderPills({ selectedCategory: "gaming" });

      expect(screen.getByText("All").closest("[role='radio']")).toHaveAttribute(
        "aria-checked",
        "false"
      );
      expect(screen.getByText("Tech").closest("[role='radio']")).toHaveAttribute(
        "aria-checked",
        "false"
      );
    });

    it("container has role radiogroup with aria-label", () => {
      renderPills();

      const group = screen.getByRole("radiogroup", { name: "Feed categories" });
      expect(group).toBeInTheDocument();
    });
  });

  describe("Interactions", () => {
    it("clicking a pill calls onSelect with category id", async () => {
      const onSelect = vi.fn();
      const { user } = renderPills({ onSelect });

      await user.click(screen.getByText("Gaming"));
      expect(onSelect).toHaveBeenCalledWith("gaming");
    });

    it("clicking All calls onSelect with undefined", async () => {
      const onSelect = vi.fn();
      const { user } = renderPills({ selectedCategory: "gaming", onSelect });

      await user.click(screen.getByText("All"));
      expect(onSelect).toHaveBeenCalledWith(undefined);
    });
  });

  describe("Keyboard navigation", () => {
    it("tab focuses the active pill only", async () => {
      const { user } = renderPills();

      await user.tab();

      const allPill = screen.getByText("All").closest("button")!;
      expect(allPill).toHaveFocus();
      expect(allPill).toHaveAttribute("tabindex", "0");

      const gamingPill = screen.getByText("Gaming").closest("button")!;
      expect(gamingPill).toHaveAttribute("tabindex", "-1");
    });

    it("ArrowRight moves focus to next pill", async () => {
      const { user } = renderPills();

      await user.tab();
      await user.keyboard("{ArrowRight}");

      expect(screen.getByText("Gaming").closest("button")).toHaveFocus();
    });

    it("ArrowLeft moves focus to previous pill", async () => {
      const { user } = renderPills({ selectedCategory: "tech" });

      await user.tab();
      await user.keyboard("{ArrowLeft}");

      expect(screen.getByText("Gaming").closest("button")).toHaveFocus();
    });

    it("ArrowRight on last pill wraps to first pill", async () => {
      const { user } = renderPills({ selectedCategory: "news" });

      await user.tab();
      await user.keyboard("{ArrowRight}");

      expect(screen.getByText("All").closest("button")).toHaveFocus();
    });

    it("ArrowLeft on first pill wraps to last pill", async () => {
      const { user } = renderPills();

      await user.tab();
      await user.keyboard("{ArrowLeft}");

      expect(screen.getByText("News").closest("button")).toHaveFocus();
    });

    it("Home moves focus to first pill", async () => {
      const { user } = renderPills({ selectedCategory: "news" });

      await user.tab();
      await user.keyboard("{Home}");

      expect(screen.getByText("All").closest("button")).toHaveFocus();
    });

    it("End moves focus to last pill", async () => {
      const { user } = renderPills();

      await user.tab();
      await user.keyboard("{End}");

      expect(screen.getByText("News").closest("button")).toHaveFocus();
    });
  });

  describe("Search-active state", () => {
    it("selected pill retains aria-checked and tabindex during search", () => {
      renderPills({ selectedCategory: "gaming", isSearchActive: true });

      const gamingPill = screen.getByText("Gaming").closest("[role='radio']")!;
      expect(gamingPill).toHaveAttribute("aria-checked", "true");
      expect(gamingPill).toHaveAttribute("tabindex", "0");
    });

    it("radiogroup has aria-description when search is active", () => {
      renderPills({ isSearchActive: true });

      const group = screen.getByRole("radiogroup");
      expect(group).toHaveAttribute(
        "aria-description",
        "Search is filtering results. Select a category to clear search."
      );
    });

    it("radiogroup has no aria-description when search is not active", () => {
      renderPills({ isSearchActive: false });

      const group = screen.getByRole("radiogroup");
      expect(group).not.toHaveAttribute("aria-description");
    });
  });
});
