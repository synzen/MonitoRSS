import {
  Box,
  Button,
  Grid,
  HStack,
  Text,
  VisuallyHidden,
} from "@chakra-ui/react";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa6";
import {
  NativeSelectField,
  NativeSelectRoot,
} from "@/components/ui/native-select";
import { PAGE_SIZE_OPTIONS } from "../constants";

interface PaginationSectionProps {
  page: number;
  pageSize: number;
  totalCount: number;
  isFetching: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  ariaLabel?: string;
  marginBottom?: number;
}

type PageItem = number | `ellipsis-before-${number}`;

function getVisiblePageItems(page: number, pageCount: number): PageItem[] {
  const pageNumbers = Array.from(
    new Set([1, page - 1, page, page + 1, pageCount]),
  ).filter((pageNumber) => pageNumber >= 1 && pageNumber <= pageCount);
  const items: PageItem[] = [];

  pageNumbers
    .sort((a, b) => a - b)
    .forEach((pageNumber, index) => {
      if (index > 0 && pageNumber - pageNumbers[index - 1] > 1) {
        items.push(`ellipsis-before-${pageNumber}`);
      }

      items.push(pageNumber);
    });

  return items;
}

export const PaginationSection: React.FC<PaginationSectionProps> = ({
  page,
  pageSize,
  totalCount,
  isFetching,
  onPageChange,
  onPageSizeChange,
  ariaLabel = "Feed table pagination",
  marginBottom = 20,
}) => {
  const pageCount = Math.max(1, Math.ceil(totalCount / pageSize));
  const firstResult = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastResult = Math.min(page * pageSize, totalCount);
  const pageItems = getVisiblePageItems(page, pageCount);

  return (
    <Box as="nav" aria-label={ariaLabel} mb={marginBottom}>
      <Grid
        alignItems="center"
        gap={{ base: 3, md: 4 }}
        gridTemplateAreas={{
          base: '"summary rows" "pager pager"',
          md: '"summary pager rows"',
        }}
        gridTemplateColumns={{
          base: "minmax(0, 1fr) auto",
          md: "auto minmax(0, 1fr) auto",
        }}
      >
        <Box gridArea="summary">
          <VisuallyHidden aria-live="polite">
            Showing feeds {firstResult.toLocaleString()} through{" "}
            {lastResult.toLocaleString()} of {totalCount.toLocaleString()}.
          </VisuallyHidden>
          <Text color="fg.muted" fontSize="sm">
            {firstResult.toLocaleString()}–{lastResult.toLocaleString()} of{" "}
            {totalCount.toLocaleString()} feeds
          </Text>
        </Box>
        <HStack
          as="ul"
          gap={1}
          gridArea="pager"
          justify={{ base: "space-between", md: "flex-end" }}
          listStyleType="none"
          width={{ base: "100%", md: "auto" }}
        >
          <Box as="li" flexShrink={0}>
            <Button
              aria-label="Previous page"
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1 || isFetching}
              size="sm"
              variant="ghost"
            >
              <FaChevronLeft aria-hidden="true" />
              Previous
            </Button>
          </Box>
          <Box as="li" display={{ base: "block", sm: "none" }}>
            <Text color="fg.muted" fontSize="sm" whiteSpace="nowrap">
              Page {page} of {pageCount}
            </Text>
          </Box>
          {pageItems.map((item) =>
            typeof item === "string" ? (
              <Box
                as="li"
                display={{ base: "none", sm: "block" }}
                key={item}
                aria-label="More pages"
                px={1}
              >
                <Text color="fg.muted">…</Text>
              </Box>
            ) : (
              <Box as="li" display={{ base: "none", sm: "block" }} key={item}>
                <Button
                  aria-current={item === page ? "page" : undefined}
                  aria-label={`Page ${item}`}
                  disabled={isFetching}
                  onClick={() => onPageChange(item)}
                  size="sm"
                  variant={item === page ? "subtle" : "ghost"}
                  colorPalette={item === page ? "brand" : undefined}
                >
                  {item}
                </Button>
              </Box>
            ),
          )}
          <Box as="li" flexShrink={0}>
            <Button
              aria-label="Next page"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= pageCount || isFetching}
              size="sm"
              variant="ghost"
            >
              Next
              <FaChevronRight aria-hidden="true" />
            </Button>
          </Box>
        </HStack>
        <HStack gap={2} gridArea="rows">
          <Text color="fg.muted" fontSize="sm">
            Rows
          </Text>
          <NativeSelectRoot size="sm" width="auto">
            <NativeSelectField
              aria-label="Feeds per page"
              value={String(pageSize)}
              onChange={(event) => onPageSizeChange(Number(event.target.value))}
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </NativeSelectField>
          </NativeSelectRoot>
        </HStack>
      </Grid>
    </Box>
  );
};
