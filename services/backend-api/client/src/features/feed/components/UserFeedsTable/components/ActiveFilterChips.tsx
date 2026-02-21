import { useRef } from "react";
import { Button, HStack, Tag, TagCloseButton, TagLabel } from "@chakra-ui/react";
import { UserFeedComputedStatus } from "../../../types";
import { STATUS_FILTERS } from "../constants";

interface ActiveFilterChipsProps {
  search: string;
  onSearchClear: () => void;
  statusFilters: UserFeedComputedStatus[];
  onStatusFiltersClear: () => void;
  searchInputRef?: React.RefObject<HTMLInputElement>;
}

export const ActiveFilterChips: React.FC<ActiveFilterChipsProps> = ({
  search,
  onSearchClear,
  statusFilters,
  onStatusFiltersClear,
  searchInputRef,
}) => {
  const statusChipRef = useRef<HTMLButtonElement>(null);
  const searchChipRef = useRef<HTMLButtonElement>(null);

  const hasSearch = !!search;
  const hasStatusFilters = statusFilters.length > 0;
  const hasMultipleFilterTypes = hasSearch && hasStatusFilters;

  if (!hasSearch && !hasStatusFilters) {
    return null;
  }

  const statusLabels = statusFilters
    .map((s) => STATUS_FILTERS.find((f) => f.value === s)?.label)
    .filter(Boolean)
    .join(", ");

  const handleSearchClear = () => {
    if (hasStatusFilters) {
      statusChipRef.current?.focus();
    } else {
      searchInputRef?.current?.focus();
    }
    onSearchClear();
  };

  const handleStatusClear = () => {
    if (hasSearch) {
      searchChipRef.current?.focus();
    } else {
      searchInputRef?.current?.focus();
    }
    onStatusFiltersClear();
  };

  const handleClearAll = () => {
    searchInputRef?.current?.focus();
    onSearchClear();
    onStatusFiltersClear();
  };

  return (
    <HStack role="group" aria-label="Active filters" flexWrap="wrap" spacing={2}>
      {hasSearch && (
        <Tag size="md" variant="subtle" colorScheme="blue">
          <TagLabel>
            <strong>Search:</strong> &ldquo;{search}&rdquo;
          </TagLabel>
          <TagCloseButton
            ref={searchChipRef}
            aria-label="Remove search filter"
            onClick={handleSearchClear}
            minW="24px"
            minH="24px"
          />
        </Tag>
      )}
      {hasStatusFilters && (
        <Tag size="md" variant="subtle" colorScheme="blue">
          <TagLabel>
            <strong>Status:</strong> {statusLabels}
          </TagLabel>
          <TagCloseButton
            ref={statusChipRef}
            aria-label="Remove status filter"
            onClick={handleStatusClear}
            minW="24px"
            minH="24px"
          />
        </Tag>
      )}
      {hasMultipleFilterTypes && (
        <Button variant="link" colorScheme="blue" size="sm" onClick={handleClearAll}>
          Clear all filters
        </Button>
      )}
    </HStack>
  );
};
