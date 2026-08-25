import { useRef } from "react";
import { Button, HStack, Tag } from "@chakra-ui/react";
import { UserFeedComputedStatus } from "../../../types";
import { STATUS_FILTERS } from "../constants";
import type { WorkspaceTag } from "@/features/workspaceTags";

interface ActiveFilterChipsProps {
  search: string;
  onSearchClear: () => void;
  statusFilters: UserFeedComputedStatus[];
  onStatusFiltersClear: () => void;
  tags: WorkspaceTag[];
  onTagsClear: () => void;
  onClearAll: () => void;
  onTagFilterFocus?: () => void;
  searchInputRef?: React.RefObject<HTMLInputElement>;
}

export const ActiveFilterChips: React.FC<ActiveFilterChipsProps> = ({
  search,
  onSearchClear,
  statusFilters,
  onStatusFiltersClear,
  tags,
  onTagsClear,
  onClearAll,
  onTagFilterFocus,
  searchInputRef,
}) => {
  const statusChipRef = useRef<HTMLButtonElement>(null);
  const searchChipRef = useRef<HTMLButtonElement>(null);
  const tagsChipRef = useRef<HTMLButtonElement>(null);

  const hasSearch = !!search;
  const hasStatusFilters = statusFilters.length > 0;
  const hasTagFilters = tags.length > 0;
  const activeFilterTypeCount = [hasSearch, hasStatusFilters, hasTagFilters].filter(Boolean).length;
  const hasMultipleFilterTypes = activeFilterTypeCount > 1;

  if (!hasSearch && !hasStatusFilters && !hasTagFilters) {
    return null;
  }

  const statusLabels = statusFilters
    .map((s) => STATUS_FILTERS.find((f) => f.value === s)?.label)
    .filter(Boolean)
    .join(", ");

  const handleSearchClear = () => {
    if (hasStatusFilters) {
      statusChipRef.current?.focus();
    } else if (hasTagFilters) {
      tagsChipRef.current?.focus();
    } else {
      searchInputRef?.current?.focus();
    }

    onSearchClear();
  };

  const handleStatusClear = () => {
    if (hasSearch) {
      searchChipRef.current?.focus();
    } else if (hasTagFilters) {
      tagsChipRef.current?.focus();
    } else {
      searchInputRef?.current?.focus();
    }

    onStatusFiltersClear();
  };

  const handleTagsClear = () => {
    if (hasSearch) {
      searchChipRef.current?.focus();
    } else if (hasStatusFilters) {
      statusChipRef.current?.focus();
    } else {
      onTagFilterFocus?.();
    }

    onTagsClear();
  };

  const handleClearAll = () => {
    searchInputRef?.current?.focus();
    onClearAll();
  };

  return (
    <HStack role="group" aria-label="Active filters" flexWrap="wrap" gap={2}>
      {hasSearch && (
        <Tag.Root size="lg" variant="subtle" colorPalette="brand">
          <Tag.Label>
            <strong>Search:</strong> &ldquo;{search}&rdquo;
          </Tag.Label>
          <Tag.EndElement>
            <Tag.CloseTrigger
              ref={searchChipRef}
              aria-label="Remove search filter"
              onClick={handleSearchClear}
            />
          </Tag.EndElement>
        </Tag.Root>
      )}
      {hasStatusFilters && (
        <Tag.Root size="lg" variant="subtle" colorPalette="brand">
          <Tag.Label>
            <strong>Status:</strong> {statusLabels}
          </Tag.Label>
          <Tag.EndElement>
            <Tag.CloseTrigger
              ref={statusChipRef}
              aria-label="Remove status filter"
              onClick={handleStatusClear}
            />
          </Tag.EndElement>
        </Tag.Root>
      )}
      {hasTagFilters && (
        <Tag.Root size="lg" variant="subtle" colorPalette="brand">
          <Tag.Label>
            <strong>Tags:</strong> {tags.map((tag) => tag.name).join(", ")}
          </Tag.Label>
          <Tag.EndElement>
            <Tag.CloseTrigger
              ref={tagsChipRef}
              aria-label="Remove tag filters"
              onClick={handleTagsClear}
            />
          </Tag.EndElement>
        </Tag.Root>
      )}
      {hasMultipleFilterTypes && (
        <Button variant="plain" colorPalette="brand" size="sm" onClick={handleClearAll}>
          Clear all filters
        </Button>
      )}
    </HStack>
  );
};
