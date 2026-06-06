import { Tabs } from "@chakra-ui/react";
import React from "react";

export const ALL_TAB_VALUE = "all";

interface CategoryPillsProps {
  categories: Array<{ id: string; label: string; count: number }>;
  isSearchActive?: boolean;
}

export const CategoryPills: React.FC<CategoryPillsProps> = ({ categories, isSearchActive }) => {
  const items = [{ id: ALL_TAB_VALUE, label: "All" }, ...categories];

  return (
    <Tabs.List
      aria-label="Feed categories"
      {...(isSearchActive && {
        "aria-description": "Search is filtering results. Select a category to clear search.",
      })}
      flexWrap="wrap"
      gap={1}
      // The cobalt neutral ladder is too collapsed for the enclosed recipe's
      // bg.muted track / bg active cell to read (both ~1.2:1 vs the panel). Paint
      // a perceptible track and carry selection on the active cell's border+shadow
      // (a shape cue, not color) so it survives the flat ladder and WCAG 1.4.1.
      bg="bg.emphasized"
    >
      {items.map((item) => (
        <Tabs.Trigger
          key={item.id}
          value={item.id}
          // fitted gives each trigger flex:1; minW lets them wrap into groups on
          // narrow/mobile widths instead of stacking one per row. nowrap keeps each
          // label on a single line so the equal-width slices don't break two-word
          // labels ("Anime & Manga") onto two lines.
          minW="24"
          whiteSpace="nowrap"
          color="fg.muted"
          borderWidth="1px"
          borderColor="transparent"
          _selected={{
            bg: "bg.panel",
            color: "fg",
            borderColor: "controlBorder",
            shadow: "xs",
          }}
          {...(isSearchActive && { borderStyle: "dashed" })}
        >
          {item.label}
        </Tabs.Trigger>
      ))}
    </Tabs.List>
  );
};
