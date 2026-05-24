import {
  useState,
  useRef,
  useCallback,
  useEffect,
  RefObject,
  MutableRefObject,
  FormEvent,
} from "react";
import {
  Alert,
  AlertDescription,
  AlertIcon,
  Box,
  HStack,
  Text,
  Input,
  InputGroup,
  InputLeftElement,
  InputRightElement,
  IconButton,
  Button,
  Skeleton,
  Stack,
  VisuallyHidden,
} from "@chakra-ui/react";
import { SearchIcon, CloseIcon } from "@chakra-ui/icons";
import { FeedCard } from "../FeedCard";
import { useCuratedFeeds } from "../../hooks";
import type { CuratedFeed } from "../../types";
import { useCreateUserFeedUrlValidation } from "../../hooks/useCreateUserFeedUrlValidation";
import { UrlValidationResult } from "./UrlValidationResult";
import type { FeedActionState } from "../../types/FeedActionState";
import { PlatformHint, getNoResultsAnnouncement, getPlatformHint } from "./PlatformHint";
import { getFeedCardPropsFromState } from "../../types/FeedActionState";
import { createDiscoverySearchEvent } from "../../api/createDiscoverySearchEvent";

interface FeedDiscoverySearchProps {
  feedActionStates: Record<string, FeedActionState>;
  isAtLimit: boolean;
  onAdd: (feed: CuratedFeed) => void;
  onRemove?: (feedKey: string) => void;
  searchInputRef?: RefObject<HTMLInputElement>;
  onSearchChange?: (query: string) => void;
  onFeedAdded?: (feedId: string, feedUrl: string) => void;
  onFeedRemoved?: (feedUrl: string) => void;
}

const URL_PATTERN = /^https?:\/\//;
const BATCH_SIZE = 20;

export function useFeedDiscoverySearchState({
  feedActionStates,
  isAtLimit,
  onAdd,
  onRemove,
  searchInputRef,
  onSearchChange,
  onFeedAdded,
  onFeedRemoved,
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
  const hasPlatformHint = !!activeQuery && !isUrlInput && !!getPlatformHint(activeQuery);
  const shouldFetchCurated = !!activeQuery && !isUrlInput && !hasPlatformHint;
  const {
    data,
    isFetching: isCuratedFetching,
    error: curatedError,
    refetch: refetchCurated,
  } = useCuratedFeeds(
    shouldFetchCurated
      ? { search: activeQuery }
      : hasPlatformHint
        ? { search: activeQuery, enabled: false }
        : undefined,
  );
  const isSearching = isCuratedFetching && shouldFetchCurated;
  const hasCuratedError = !!curatedError && shouldFetchCurated;

  const hasActiveSearch = activeQuery.length > 0;
  const totalResults = isUrlInput ? 0 : (data?.feeds.length ?? 0);
  const visibleResults = data?.feeds.slice(0, visibleCount) ?? [];

  useEffect(() => {
    if (!activeQuery || isUrlInput) return;

    createDiscoverySearchEvent({
      searchTerm: activeQuery,
      resultCount: totalResults,
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeQuery]);

  const setInputRef = useCallback(
    (node: HTMLInputElement | null) => {
      (inputRef as MutableRefObject<HTMLInputElement | null>).current = node;

      if (searchInputRef) {
        (searchInputRef as MutableRefObject<HTMLInputElement | null>).current = node;
      }
    },
    [searchInputRef],
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
        `[data-feed-index="${previousCount}"] button`,
      ) as HTMLElement | null;

      nextItem?.focus();
    });
  };

  const initializeWithQuery = useCallback(
    async (query: string) => {
      const trimmed = query.trim();
      if (!trimmed) return;

      setInputValue(trimmed);
      setActiveQuery(trimmed);
      setVisibleCount(BATCH_SIZE);
      onSearchChange?.(trimmed);

      if (URL_PATTERN.test(trimmed)) {
        resetValidation();
        try {
          await validateUrl({ details: { url: trimmed } });
        } catch {
          // Error state handled by hook
        }
      }
    },
    [onSearchChange, resetValidation, validateUrl],
  );

  return {
    inputValue,
    setInputValue,
    activeQuery,
    isUrlInput,
    hasActiveSearch,
    totalResults,
    visibleResults,
    visibleCount,
    isSearching,
    hasCuratedError,
    refetchCurated,
    setInputRef,
    getCategoryLabel,
    handleSearch,
    handleClear,
    handleTrySearchByName,
    handleRetryValidation,
    handleShowMore,
    initializeWithQuery,
    validationStatus,
    validationError,
    validationData,
    feedActionStates,
    isAtLimit,
    onAdd,
    onRemove,
    onFeedAdded,
    onFeedRemoved,
  };
}

type SearchStateReturn = ReturnType<typeof useFeedDiscoverySearchState>;

function getSearchAnnouncement(state: SearchStateReturn): string {
  if (!state.hasActiveSearch || state.isUrlInput) return "";
  if (state.isSearching) return `Loading search results for ${state.activeQuery}`;
  if (state.hasCuratedError) {
    return `Failed to load search results for ${state.activeQuery}`;
  }
  if (state.totalResults === 0) return getNoResultsAnnouncement(state.activeQuery);
  return `${state.totalResults} result${state.totalResults !== 1 ? "s" : ""} for ${state.activeQuery}`;
}

export const FeedDiscoverySearchInput = ({ state }: { state: SearchStateReturn }) => (
  <Box>
    <VisuallyHidden role="status" aria-live="polite" aria-atomic="true">
      {getSearchAnnouncement(state)}
    </VisuallyHidden>
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

  if (state.isSearching) {
    return (
      <Box mt={3} aria-busy="true" aria-hidden="true">
        <Stack spacing={2}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} height="64px" borderRadius="md" />
          ))}
        </Stack>
      </Box>
    );
  }

  if (state.hasCuratedError) {
    return (
      <Alert status="error" mt={3} borderRadius="md">
        <AlertIcon />
        <AlertDescription>
          Failed to load search results.{" "}
          <Button variant="link" colorScheme="blue" onClick={() => state.refetchCurated()}>
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <>
      {state.totalResults > 0 && (
        <Box mt={3}>
          <Text fontSize="sm" color="gray.400">
            {state.totalResults} result{state.totalResults !== 1 ? "s" : ""} for &ldquo;
            {state.activeQuery}&rdquo;
          </Text>
        </Box>
      )}

      <Box mt={3}>
        {state.totalResults > 0 && (
          <Stack
            as="ul"
            role="list"
            aria-label={`Search results, showing ${Math.min(
              state.visibleCount,
              state.totalResults,
            )} of ${state.totalResults}`}
            spacing={2}
            listStyleType="none"
          >
            {state.visibleResults.map((feed, index) => {
              const cardProps = getFeedCardPropsFromState(
                state.feedActionStates,
                feed.id,
                state.isAtLimit,
              );

              return (
                <Box as="li" key={feed.id} data-feed-index={index}>
                  <FeedCard
                    feed={feed}
                    state={cardProps.state}
                    onAdd={() => state.onAdd(feed)}
                    onRemove={state.onRemove ? () => state.onRemove!(feed.id) : undefined}
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
            onFeedRemoved={state.onFeedRemoved}
          />
        )}

        {!state.isUrlInput && state.totalResults === 0 && (
          <PlatformHint query={state.activeQuery} />
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
