import { SimpleGrid, Box, Text, Icon, Flex } from "@chakra-ui/react";
import React, { useRef, useCallback, useState } from "react";
import {
  FaGamepad,
  FaCrosshairs,
  FaBookOpen,
  FaLaptopCode,
  FaFootballBall,
  FaChartLine,
  FaGlobe,
  FaFilm,
  FaCompass,
} from "react-icons/fa";
import type { IconType } from "react-icons";
import type { CuratedCategory } from "../../types";

const CATEGORY_ICONS: Record<string, { icon: IconType; color: string }> = {
  gaming: { icon: FaGamepad, color: "purple.300" },
  "specific-games": { icon: FaCrosshairs, color: "red.300" },
  anime: { icon: FaBookOpen, color: "pink.300" },
  tech: { icon: FaLaptopCode, color: "cyan.300" },
  sports: { icon: FaFootballBall, color: "green.300" },
  finance: { icon: FaChartLine, color: "yellow.300" },
  news: { icon: FaGlobe, color: "blue.300" },
  entertainment: { icon: FaFilm, color: "orange.300" },
};

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
      {categories.map((category, index) => {
        const iconConfig = CATEGORY_ICONS[category.id];

        return (
          <Flex
            as="button"
            key={category.id}
            ref={(el: HTMLButtonElement | null) => {
              buttonRefs.current[index] = el;
            }}
            role="radio"
            aria-checked={false}
            direction="column"
            align="center"
            w="100%"
            bg="gray.800"
            borderWidth="1px"
            borderColor="gray.600"
            borderRadius="md"
            p={5}
            textAlign="center"
            _hover={{ borderColor: "gray.400" }}
            _focus={{
              outline: "2px solid",
              outlineColor: "blue.400",
              outlineOffset: "2px",
            }}
            tabIndex={focusedIndex === index ? 0 : -1}
            onClick={() => onSelectCategory(category.id)}
            aria-label={`${category.label}. ${getCategoryPreviewText(category.id)}`}
          >
            {iconConfig && (
              <Icon
                as={iconConfig.icon}
                boxSize="40px"
                color={iconConfig.color}
                mb={3}
                aria-hidden="true"
              />
            )}
            <Text fontWeight="bold" mb={1}>
              {category.label}
            </Text>
            <Text color="gray.400" fontSize="sm" noOfLines={2}>
              {getCategoryPreviewText(category.id)}
            </Text>
          </Flex>
        );
      })}
      <Flex
        as="button"
        ref={(el: HTMLButtonElement | null) => {
          buttonRefs.current[categories.length] = el;
        }}
        role="radio"
        aria-checked={false}
        direction="column"
        align="center"
        w="100%"
        borderWidth="1px"
        borderStyle="dashed"
        borderColor="gray.600"
        borderRadius="md"
        p={5}
        textAlign="center"
        _hover={{ borderColor: "gray.400" }}
        _focus={{
          outline: "2px solid",
          outlineColor: "blue.400",
          outlineOffset: "2px",
        }}
        tabIndex={focusedIndex === categories.length ? 0 : -1}
        onClick={() => onSelectCategory(undefined)}
      >
        <Icon as={FaCompass} boxSize="40px" color="gray.400" mb={3} aria-hidden="true" />
        <Text fontWeight="bold" mb={1}>
          Browse All Categories
        </Text>
        <Text color="gray.400" fontSize="sm">
          {totalFeedCount} popular feeds to explore &rarr;
        </Text>
      </Flex>
    </SimpleGrid>
  );
};
