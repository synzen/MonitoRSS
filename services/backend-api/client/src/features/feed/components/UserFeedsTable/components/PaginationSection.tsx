import { Box, Button, Flex, HStack, Text, VisuallyHidden } from "@chakra-ui/react";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa6";
import { NativeSelectField, NativeSelectRoot } from "@/components/ui/native-select";
import { PAGE_SIZE_OPTIONS } from "../constants";

interface PaginationSectionProps {
  page: number;
  pageSize: number;
  totalCount: number;
  isFetching: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

type PageItem = number | `ellipsis-before-${number}`;

function getVisiblePageItems(page: number, pageCount: number): PageItem[] {
  const pageNumbers = Array.from(new Set([1, page - 1, page, page + 1, pageCount])).filter(
    (pageNumber) => pageNumber >= 1 && pageNumber <= pageCount,
  );
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
}) => {
  const pageCount = Math.max(1, Math.ceil(totalCount / pageSize));
  const firstResult = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastResult = Math.min(page * pageSize, totalCount);
  const pageItems = getVisiblePageItems(page, pageCount);

  return (
    <Box as="nav" aria-label="Feed table pagination" mb={20}>
      <Flex
        align="center"
        direction={{ base: "column", md: "row" }}
        gap={4}
        justify="space-between"
      >
        <Box>
          <VisuallyHidden aria-live="polite">
            Showing feeds {firstResult.toLocaleString()} through {lastResult.toLocaleString()} of{" "}
            {totalCount.toLocaleString()}.
          </VisuallyHidden>
          <Text>
            {firstResult.toLocaleString()}–{lastResult.toLocaleString()} of{" "}
            {totalCount.toLocaleString()} feeds
          </Text>
        </Box>
        <HStack flexWrap="wrap" justify={{ base: "flex-start", md: "flex-end" }}>
          <HStack as="ul" listStyleType="none">
            <Box as="li">
              <Button
                aria-label="Previous page"
                onClick={() => onPageChange(page - 1)}
                disabled={page <= 1 || isFetching}
                size="sm"
                variant="outline"
              >
                <FaChevronLeft aria-hidden="true" />
                Previous
              </Button>
            </Box>
            {pageItems.map((item) =>
              typeof item === "string" ? (
                <Box as="li" key={item} aria-label="More pages">
                  <Text>…</Text>
                </Box>
              ) : (
                <Box as="li" key={item}>
                  <Button
                    aria-current={item === page ? "page" : undefined}
                    aria-label={`Page ${item}`}
                    disabled={isFetching}
                    onClick={() => onPageChange(item)}
                    size="sm"
                    variant={item === page ? "solid" : "outline"}
                  >
                    {item}
                  </Button>
                </Box>
              ),
            )}
            <Box as="li">
              <Button
                aria-label="Next page"
                onClick={() => onPageChange(page + 1)}
                disabled={page >= pageCount || isFetching}
                size="sm"
                variant="outline"
              >
                Next
                <FaChevronRight aria-hidden="true" />
              </Button>
            </Box>
          </HStack>
          <HStack>
            <Text>Rows</Text>
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
        </HStack>
      </Flex>
    </Box>
  );
};
