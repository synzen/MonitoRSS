import { SimpleGrid, Box, Text } from "@chakra-ui/react";
import React, { useRef, useCallback, useState } from "react";
import type { CuratedCategory } from "../../types";

interface CategoryGridProps {
  categories: CuratedCategory[];
  totalFeedCount: number;
  getCategoryPreviewText: (categoryId: string) => string;
  onSelectCategory: (categoryId?: string) => void;
  columns?: { base: number; sm: number; md: number };
}

export const CategoryGrid: React.FC<CategoryGridProps> = ({
  categories,
  totalFeedCount,
  getCategoryPreviewText,
  onSelectCategory,
  columns = { base: 1, sm: 2, md: 3 },
}) => {
  const totalItems = categories.length + 1;
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [focusedIndex, setFocusedIndex] = useState(0);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      let nextIndex: number | null = null;

      switch (e.key) {
        case "ArrowRight":
          nextIndex = (focusedIndex + 1) % totalItems;
          break;
        case "ArrowLeft":
          nextIndex = (focusedIndex - 1 + totalItems) % totalItems;
          break;
        case "Home":
          nextIndex = 0;
          break;
        case "End":
          nextIndex = totalItems - 1;
          break;
        default:
          return;
      }

      e.preventDefault();
      setFocusedIndex(nextIndex);
      buttonRefs.current[nextIndex]?.focus();
    },
    [totalItems, focusedIndex],
  );

  return (
    <SimpleGrid
      role="radiogroup"
      aria-label="Feed categories"
      columns={columns}
      spacing={4}
      onKeyDown={onKeyDown}
    >
      {categories.map((category, index) => (
        <Box
          as="button"
          key={category.id}
          ref={(el: HTMLButtonElement | null) => {
            buttonRefs.current[index] = el;
          }}
          role="radio"
          aria-checked={false}
          w="100%"
          bg="gray.800"
          borderWidth="1px"
          borderColor="gray.600"
          borderRadius="md"
          p={4}
          textAlign="left"
          _hover={{ borderColor: "gray.400" }}
          _focus={{ outline: "2px solid", outlineColor: "blue.400", outlineOffset: "2px" }}
          tabIndex={focusedIndex === index ? 0 : -1}
          onClick={() => onSelectCategory(category.id)}
          aria-label={`${category.label}. ${getCategoryPreviewText(category.id)}`}
        >
          <Text fontWeight="bold" mb={1}>
            {category.label}
          </Text>
          <Text color="gray.400" fontSize="sm" noOfLines={2}>
            {getCategoryPreviewText(category.id)}
          </Text>
        </Box>
      ))}
      <Box
        as="button"
        ref={(el: HTMLButtonElement | null) => {
          buttonRefs.current[categories.length] = el;
        }}
        role="radio"
        aria-checked={false}
        w="100%"
        borderWidth="1px"
        borderStyle="dashed"
        borderColor="gray.600"
        borderRadius="md"
        p={4}
        textAlign="left"
        _hover={{ borderColor: "gray.400" }}
        _focus={{ outline: "2px solid", outlineColor: "blue.400", outlineOffset: "2px" }}
        tabIndex={focusedIndex === categories.length ? 0 : -1}
        onClick={() => onSelectCategory(undefined)}
      >
        <Text fontWeight="bold" mb={1}>
          Browse All
        </Text>
        <Text color="gray.400" fontSize="sm">
          See all {totalFeedCount} feeds &rarr;
        </Text>
      </Box>
    </SimpleGrid>
  );
};
