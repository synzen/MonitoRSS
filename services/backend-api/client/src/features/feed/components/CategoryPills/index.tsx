import { Button, Flex } from "@chakra-ui/react";
import React, { useRef, useCallback } from "react";

interface CategoryPillsProps {
  categories: Array<{ id: string; label: string; count: number }>;
  selectedCategory: string | undefined;
  onSelect: (categoryId: string | undefined) => void;
  isSearchActive?: boolean;
}

export const CategoryPills: React.FC<CategoryPillsProps> = ({
  categories,
  selectedCategory,
  onSelect,
  isSearchActive,
}) => {
  const pillRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const allItems: Array<{ id: string | undefined; label: string; count?: number }> = [
    { id: undefined, label: "All" },
    ...categories,
  ];

  const selectedIndex = allItems.findIndex((item) => item.id === selectedCategory);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const total = allItems.length;
      let nextIndex: number | null = null;

      switch (e.key) {
        case "ArrowRight":
          nextIndex = (selectedIndex + 1) % total;
          break;
        case "ArrowLeft":
          nextIndex = (selectedIndex - 1 + total) % total;
          break;
        case "Home":
          nextIndex = 0;
          break;
        case "End":
          nextIndex = total - 1;
          break;
        default:
          return;
      }

      e.preventDefault();
      onSelect(allItems[nextIndex].id);
      pillRefs.current[nextIndex]?.focus();
    },
    [allItems, selectedIndex, onSelect]
  );

  return (
    <Flex
      role="radiogroup"
      aria-label="Feed categories"
      {...(isSearchActive && {
        "aria-description": "Search is filtering results. Select a category to clear search.",
      })}
      flexWrap="wrap"
      gap={2}
      onKeyDown={onKeyDown}
    >
      {allItems.map((item, index) => {
        const isSelected = item.id === selectedCategory;

        return (
          <Button
            key={item.id ?? "__all__"}
            ref={(el) => {
              pillRefs.current[index] = el;
            }}
            size="sm"
            variant={isSelected ? "solid" : "outline"}
            colorScheme={isSelected ? "blue" : undefined}
            borderStyle={!isSelected && isSearchActive ? "dashed" : undefined}
            borderColor={!isSelected && isSearchActive ? "gray.400" : undefined}
            color={!isSelected && isSearchActive ? "gray.300" : undefined}
            role="radio"
            aria-checked={isSelected}
            tabIndex={isSelected ? 0 : -1}
            onClick={() => onSelect(item.id)}
          >
            {item.label}
          </Button>
        );
      })}
    </Flex>
  );
};
