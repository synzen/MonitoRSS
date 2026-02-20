import { useState, useRef, useCallback, RefObject, MutableRefObject, FormEvent } from "react";
import {
  Box,
  HStack,
  Text,
  Input,
  InputGroup,
  InputLeftElement,
  InputRightElement,
  IconButton,
  Button,
  Stack,
} from "@chakra-ui/react";
import { SearchIcon, CloseIcon } from "@chakra-ui/icons";
import { FeedCard } from "../FeedCard";
import { useCuratedFeeds } from "../../hooks";
import type { CuratedFeed } from "../../types";
import { useCreateUserFeedUrlValidation } from "../../hooks/useCreateUserFeedUrlValidation";
import { UrlValidationResult } from "./UrlValidationResult";
import type { FeedActionState } from "../../types/FeedActionState";
import { getFeedCardPropsFromState } from "../../types/FeedActionState";

interface FeedDiscoverySearchProps {
  feedActionStates: Record<string, FeedActionState>;
  isAtLimit: boolean;
  onAdd: (feed: CuratedFeed) => void;
  searchInputRef?: RefObject<HTMLInputElement>;
  onSearchChange?: (query: string) => void;
  onFeedAdded?: (feedId: string, feedUrl: string) => void;
}

const URL_PATTERN = /^https?:\/\//;
const BATCH_SIZE = 20;

export function useFeedDiscoverySearchState({
  feedActionStates,
  isAtLimit,
  onAdd,
  searchInputRef,
  onSearchChange,
  onFeedAdded,
}: FeedDiscoverySearchProps) {
  const [inputValue, setInputValue] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const {
    mutateAsync: validateUrl,
    status: validationStatus,
    error: validationError,
    data: validationData,
    reset: resetValidation,
  } = useCreateUserFeedUrlValidation();

  const isUrlInput = URL_PATTERN.test(activeQuery);
  const { data } = useCuratedFeeds(
    activeQuery && !isUrlInput ? { search: activeQuery } : undefined
  );

  const hasActiveSearch = activeQuery.length > 0;
  const totalResults = isUrlInput ? 0 : data?.feeds.length ?? 0;
  const visibleResults = data?.feeds.slice(0, visibleCount) ?? [];

  const setInputRef = useCallback(
    (node: HTMLInputElement | null) => {
      (inputRef as MutableRefObject<HTMLInputElement | null>).current = node;

      if (searchInputRef) {
        (searchInputRef as MutableRefObject<HTMLInputElement | null>).current = node;
      }
    },
    [searchInputRef]
  );

  const getCategoryLabel = (categoryId: string) =>
    data?.categories.find((c) => c.id === categoryId)?.label || categoryId;

  const handleSearch = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = inputValue.trim();

    if (!trimmed) {
      if (activeQuery) {
        handleClear();
      }

      return;
    }

    setActiveQuery(trimmed);
    setVisibleCount(BATCH_SIZE);
    onSearchChange?.(trimmed);

    if (URL_PATTERN.test(trimmed)) {
      resetValidation();

      try {
        await validateUrl({ details: { url: trimmed } });
      } catch {
        // Error state is handled by the hook's error property
      }
    }
  };

  const handleClear = () => {
    setInputValue("");
    setActiveQuery("");
    setVisibleCount(BATCH_SIZE);
    resetValidation();
    onSearchChange?.("");
    inputRef.current?.focus();
  };

  const handleTrySearchByName = () => {
    setInputValue("");
    setActiveQuery("");
    resetValidation();
    onSearchChange?.("");
    inputRef.current?.focus();
  };

  const handleRetryValidation = async () => {
    resetValidation();

    try {
      await validateUrl({ details: { url: activeQuery } });
    } catch {
      // Error state is handled by the hook's error property
    }
  };

  const handleShowMore = () => {
    const previousCount = visibleCount;
    setVisibleCount((prev) => prev + BATCH_SIZE);

    requestAnimationFrame(() => {
      const nextItem = document.querySelector(
        `[data-feed-index="${previousCount}"] button`
      ) as HTMLElement | null;

      nextItem?.focus();
    });
  };

  return {
    inputValue,
    setInputValue,
    activeQuery,
    isUrlInput,
    hasActiveSearch,
    totalResults,
    visibleResults,
    visibleCount,
    setInputRef,
    getCategoryLabel,
    handleSearch,
    handleClear,
    handleTrySearchByName,
    handleRetryValidation,
    handleShowMore,
    validationStatus,
    validationError,
    validationData,
    feedActionStates,
    isAtLimit,
    onAdd,
    onFeedAdded,
  };
}

type SearchStateReturn = ReturnType<typeof useFeedDiscoverySearchState>;

export const FeedDiscoverySearchInput = ({ state }: { state: SearchStateReturn }) => (
  <Box>
    <form role="search" onSubmit={state.handleSearch}>
      <HStack>
        <InputGroup>
          <InputLeftElement pointerEvents="none">
            <SearchIcon color="gray.400" />
          </InputLeftElement>
          <Input
            ref={state.setInputRef}
            value={state.inputValue}
            onChange={(e) => state.setInputValue(e.target.value)}
            placeholder="Search popular feeds or paste a URL"
            aria-label="Search popular feeds or paste a URL"
            bg="gray.800"
          />
          {state.inputValue && (
            <InputRightElement>
              <IconButton
                aria-label="Clear search"
                icon={<CloseIcon />}
                size="xs"
                variant="ghost"
                onClick={state.handleClear}
              />
            </InputRightElement>
          )}
        </InputGroup>
        <Button type="submit">Go</Button>
      </HStack>
    </form>
  </Box>
);

export const FeedDiscoverySearchResults = ({ state }: { state: SearchStateReturn }) => {
  if (!state.hasActiveSearch) return null;

  return (
    <>
      {state.totalResults > 0 && (
        <Box aria-live="polite" mt={3}>
          <Text fontSize="sm" color="gray.400">
            {state.totalResults} result{state.totalResults !== 1 ? "s" : ""}
          </Text>
        </Box>
      )}

      <Box aria-live="polite" mt={3}>
        {state.totalResults > 0 && (
          <Stack
            as="ul"
            role="list"
            aria-label={`Search results, showing ${Math.min(
              state.visibleCount,
              state.totalResults
            )} of ${state.totalResults}`}
            spacing={2}
            listStyleType="none"
          >
            {state.visibleResults.map((feed, index) => {
              const cardProps = getFeedCardPropsFromState(
                state.feedActionStates,
                feed.url,
                state.isAtLimit
              );

              return (
                <Box as="li" key={feed.url} data-feed-index={index}>
                  <FeedCard
                    feed={feed}
                    state={cardProps.state}
                    onAdd={() => state.onAdd(feed)}
                    errorMessage={cardProps.errorMessage}
                    errorCode={cardProps.errorCode}
                    isCurated
                    showCategoryTag={state.getCategoryLabel(feed.category)}
                    feedSettingsUrl={cardProps.feedSettingsUrl}
                    previewEnabled
                    searchQuery={state.activeQuery}
                  />
                </Box>
              );
            })}
          </Stack>
        )}

        {state.isUrlInput && (
          <UrlValidationResult
            url={state.activeQuery}
            validationStatus={state.validationStatus}
            validationData={state.validationData}
            validationError={state.validationError}
            isAtLimit={state.isAtLimit}
            onTrySearchByName={state.handleTrySearchByName}
            onRetryValidation={state.handleRetryValidation}
            onFeedAdded={state.onFeedAdded}
          />
        )}

        {!state.isUrlInput && state.totalResults === 0 && (
          <Text color="gray.400">
            No matches in our popular feeds list. Many websites have feeds - try pasting a URL
            (e.g., a YouTube channel or news site) and we&apos;ll check automatically.
          </Text>
        )}
      </Box>

      {state.totalResults > state.visibleCount && (
        <Button mt={3} onClick={state.handleShowMore} variant="outline" width="full">
          Show more
        </Button>
      )}
    </>
  );
};

export const FeedDiscoverySearch = (props: FeedDiscoverySearchProps) => {
  const state = useFeedDiscoverySearchState(props);

  return (
    <Box>
      <FeedDiscoverySearchInput state={state} />
      <FeedDiscoverySearchResults state={state} />
    </Box>
  );
};
