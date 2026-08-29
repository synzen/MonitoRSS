import { Button, HStack, Stack, Text } from "@chakra-ui/react";
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

  return (
    <Stack alignItems={{ base: "stretch", md: "center" }} mb={20}>
      <Text color="fg.muted" fontSize="sm" aria-live="polite">
        {firstResult.toLocaleString()}–{lastResult.toLocaleString()} of{" "}
        {totalCount.toLocaleString()} feeds
      </Text>
      <HStack flexWrap="wrap" justifyContent="center">
        <Button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1 || isFetching}
        >
          Previous
        </Button>
        <NativeSelectRoot size="sm" width="auto">
          <NativeSelectField
            aria-label="Page"
            value={String(page)}
            onChange={(event) => onPageChange(Number(event.target.value))}
          >
            {Array.from({ length: pageCount }, (_, index) => index + 1).map(
              (pageNumber) => (
                <option key={pageNumber} value={pageNumber}>
                  Page {pageNumber} of {pageCount}
                </option>
              ),
            )}
          </NativeSelectField>
        </NativeSelectRoot>
        <Button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pageCount || isFetching}
        >
          Next
        </Button>
        <NativeSelectRoot size="sm" width="auto">
          <NativeSelectField
            aria-label="Feeds per page"
            value={String(pageSize)}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size} per page
              </option>
            ))}
          </NativeSelectField>
        </NativeSelectRoot>
      </HStack>
    </Stack>
  );
};
