import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider, Tabs } from "@chakra-ui/react";
import { describe, it, expect, vi } from "vitest";
import { system } from "@/utils/theme";
import { CategoryPills, ALL_TAB_VALUE } from "./index";

const mockCategories = [
  { id: "gaming", label: "Gaming", count: 3 },
  { id: "tech", label: "Tech", count: 2 },
  { id: "news", label: "News", count: 5 },
];

const renderPills = (
  props: Partial<React.ComponentProps<typeof CategoryPills>> & {
    value?: string;
    onValueChange?: (value: string) => void;
  } = {},
) => {
  const user = userEvent.setup();
  const { value = ALL_TAB_VALUE, onValueChange, ...pillProps } = props;

  const result = render(
    <ChakraProvider value={system}>
      <Tabs.Root
        value={value}
        onValueChange={(e) => onValueChange?.(e.value)}
        activationMode="manual"
      >
        <CategoryPills categories={mockCategories} {...pillProps} />
        <Tabs.Content value={ALL_TAB_VALUE}>All panel</Tabs.Content>
        <Tabs.Content value="gaming">Gaming panel</Tabs.Content>
        <Tabs.Content value="tech">Tech panel</Tabs.Content>
        <Tabs.Content value="news">News panel</Tabs.Content>
      </Tabs.Root>
    </ChakraProvider>,
  );

  return { user, ...result };
};

describe("CategoryPills", () => {
  describe("Rendering", () => {
    it("renders all category tabs including All", () => {
      renderPills();

      expect(screen.getByRole("tab", { name: "All" })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: "Gaming" })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: "Tech" })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: "News" })).toBeInTheDocument();
    });

    it("selected tab has aria-selected true", () => {
      renderPills({ value: "gaming" });

      expect(screen.getByRole("tab", { name: "Gaming" })).toHaveAttribute("aria-selected", "true");
    });

    it("unselected tabs have aria-selected false", () => {
      renderPills({ value: "gaming" });

      expect(screen.getByRole("tab", { name: "All" })).toHaveAttribute("aria-selected", "false");
      expect(screen.getByRole("tab", { name: "Tech" })).toHaveAttribute("aria-selected", "false");
    });

    it("container has tablist role with aria-label", () => {
      renderPills();

      expect(screen.getByRole("tablist", { name: "Feed categories" })).toBeInTheDocument();
    });

    it("the selected tab controls its panel via aria-controls", () => {
      renderPills({ value: "gaming" });

      const gamingTab = screen.getByRole("tab", { name: "Gaming" });
      const controlledId = gamingTab.getAttribute("aria-controls");
      expect(controlledId).toBeTruthy();
      expect(document.getElementById(controlledId!)).toHaveTextContent("Gaming panel");
    });
  });

  describe("Interactions", () => {
    it("clicking a tab calls onValueChange with the category id", async () => {
      const onValueChange = vi.fn();
      const { user } = renderPills({ onValueChange });

      await user.click(screen.getByRole("tab", { name: "Gaming" }));
      expect(onValueChange).toHaveBeenCalledWith("gaming");
    });

    it("clicking All calls onValueChange with the all value", async () => {
      const onValueChange = vi.fn();
      const { user } = renderPills({ value: "gaming", onValueChange });

      await user.click(screen.getByRole("tab", { name: "All" }));
      expect(onValueChange).toHaveBeenCalledWith(ALL_TAB_VALUE);
    });
  });

  describe("Keyboard navigation (manual activation)", () => {
    it("only the selected tab is in the tab sequence", async () => {
      const { user } = renderPills();

      await user.tab();

      expect(screen.getByRole("tab", { name: "All" })).toHaveFocus();
    });

    it("ArrowRight moves focus without selecting", async () => {
      const onValueChange = vi.fn();
      const { user } = renderPills({ onValueChange });

      await user.tab();
      await user.keyboard("{ArrowRight}");

      expect(screen.getByRole("tab", { name: "Gaming" })).toHaveFocus();
      expect(onValueChange).not.toHaveBeenCalled();
    });

    it("ArrowLeft moves focus without selecting", async () => {
      const onValueChange = vi.fn();
      const { user } = renderPills({ value: "tech", onValueChange });

      await user.tab();
      await user.keyboard("{ArrowLeft}");

      expect(screen.getByRole("tab", { name: "Gaming" })).toHaveFocus();
      expect(onValueChange).not.toHaveBeenCalled();
    });

    it("Enter selects the focused tab", async () => {
      const onValueChange = vi.fn();
      const { user } = renderPills({ onValueChange });

      await user.tab();
      await user.keyboard("{ArrowRight}");
      await user.keyboard("{Enter}");

      expect(onValueChange).toHaveBeenCalledWith("gaming");
    });

    it("Space selects the focused tab", async () => {
      const onValueChange = vi.fn();
      const { user } = renderPills({ onValueChange });

      await user.tab();
      await user.keyboard("{ArrowRight}{ArrowRight}");
      await user.keyboard(" ");

      expect(onValueChange).toHaveBeenCalledWith("tech");
    });
  });

  describe("Search-active state", () => {
    it("tablist has aria-description when search is active", () => {
      renderPills({ isSearchActive: true });

      expect(screen.getByRole("tablist")).toHaveAttribute(
        "aria-description",
        "Search is filtering results. Select a category to clear search.",
      );
    });

    it("tablist has no aria-description when search is not active", () => {
      renderPills({ isSearchActive: false });

      expect(screen.getByRole("tablist")).not.toHaveAttribute("aria-description");
    });
  });
});
