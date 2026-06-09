import { useState, useRef, useCallback, useEffect } from "react";
import {
  Stack,
  Box,
  Text,
  Button,
  SimpleGrid,
  Heading,
  Skeleton,
  VisuallyHidden,
  Tabs,
} from "@chakra-ui/react";
import {
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogCloseTrigger,
  DialogBody,
} from "@/components/ui/dialog";
import { Alert } from "@/components/ui/alert";
import { FeedCard } from "../FeedCard";
import { FeedLimitBar } from "../FeedLimitBar";
import {
  useFeedDiscoverySearchState,
  FeedDiscoverySearchInput,
  FeedDiscoverySearchResults,
} from "../FeedDiscoverySearch";
import { CategoryPills, ALL_TAB_VALUE } from "../CategoryPills";
import { useCuratedFeeds } from "../../hooks";
import type { CuratedFeed } from "../../types";
import type { FeedActionState } from "../../types/FeedActionState";
import { getFeedCardPropsFromState } from "../../types/FeedActionState";

interface BrowseFeedsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCategory?: string;
  initialSearchQuery?: string;
  feedActionStates: Record<string, FeedActionState>;
  isAtLimit: boolean;
  onAdd: (feed: CuratedFeed) => void;
  onRemove?: (feedKey: string) => void;
  onFeedAdded?: (feedId: string, feedUrl: string) => void;
  onFeedRemoved?: (feedUrl: string) => void;
}

const BATCH_SIZE = 20;

export const BrowseFeedsModal = ({
  isOpen,
  onClose,
  initialCategory,
  initialSearchQuery,
  feedActionStates,
  isAtLimit,
  onAdd,
  onRemove,
  onFeedAdded,
  onFeedRemoved,
}: BrowseFeedsModalProps) => {
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(
    initialCategory,
  );
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const modalBodyRef = useRef<HTMLDivElement>(null);
  const prevIsOpenRef = useRef(false);

  // Reset state during render (not in useEffect) to avoid a flash of stale state on open
  if (isOpen && !prevIsOpenRef.current) {
    prevIsOpenRef.current = true;
    setSelectedCategory(initialCategory);
    setVisibleCount(BATCH_SIZE);
    setIsSearchActive(!!initialSearchQuery);
  }

  if (!isOpen && prevIsOpenRef.current) {
    prevIsOpenRef.current = false;
  }

  const { data, getHighlightFeeds, isFetching, error, refetch } =
    useCuratedFeeds(
      selectedCategory ? { category: selectedCategory } : undefined,
    );

  const handleSearchChange = useCallback((query: string) => {
    setIsSearchActive(query.length > 0);
  }, []);

  const searchState = useFeedDiscoverySearchState({
    feedActionStates,
    isAtLimit,
    onAdd,
    onRemove,
    searchInputRef,
    onSearchChange: handleSearchChange,
    onFeedAdded,
    onFeedRemoved,
  });

  useEffect(() => {
    if (isOpen) {
      if (initialSearchQuery) {
        searchState.initializeWithQuery(initialSearchQuery);
      } else {
        searchState.handleClear();
      }
    }
  }, [isOpen]);

  const scrollModalBodyToTop = () => {
    modalBodyRef.current?.scrollTo(0, 0);
  };

  const handleCategorySelect = (categoryId: string | undefined) => {
    if (isSearchActive) {
      searchState.handleClear();
      setIsSearchActive(false);
    }

    setSelectedCategory(categoryId);
    setVisibleCount(BATCH_SIZE);
    scrollModalBodyToTop();
  };

  const handleTabChange = (value: string) => {
    handleCategorySelect(value === ALL_TAB_VALUE ? undefined : value);
  };

  const handleShowMore = () => {
    const feeds = data?.feeds ?? [];
    const previousCount = visibleCount;
    const newCount = visibleCount + BATCH_SIZE;
    const isLoadingAll = newCount >= feeds.length;
    setVisibleCount(newCount);

    requestAnimationFrame(() => {
      if (isLoadingAll) {
        const lastIndex = feeds.length - 1;
        const lastItem = document.querySelector(
          `[data-category-feed-index="${lastIndex}"] button`,
        ) as HTMLElement | null;
        lastItem?.focus();
      } else {
        const nextItem = document.querySelector(
          `[data-category-feed-index="${previousCount}"] button`,
        ) as HTMLElement | null;
        nextItem?.focus();
      }
    });
  };

  const handleSeeAll = (categoryId: string) => {
    if (isSearchActive) {
      searchState.handleClear();
      setIsSearchActive(false);
    }

    setSelectedCategory(categoryId);
    setVisibleCount(BATCH_SIZE);
    scrollModalBodyToTop();
  };

  const highlights = getHighlightFeeds();
  const visibleFeeds = data?.feeds.slice(0, visibleCount) ?? [];
  const totalFeeds = data?.feeds.length ?? 0;
  const hasMore = visibleCount < totalFeeds;
  const selectedCategoryLabel =
    (data?.categories ?? []).find((c) => c.id === selectedCategory)?.label ||
    selectedCategory;

  const categoryAnnouncement = (() => {
    if (isSearchActive) return "";

    if (isFetching) {
      return selectedCategoryLabel
        ? `Loading ${selectedCategoryLabel} feeds`
        : "Loading feeds";
    }

    if (error) return "Failed to load feeds";
    if (!data) return "";
    const label = selectedCategoryLabel ?? "popular";
    if (totalFeeds === 0) return `No ${label} feeds available`;

    return `Showing ${totalFeeds} ${label} feed${totalFeeds !== 1 ? "s" : ""}`;
  })();

  return (
    <DialogRoot
      open={isOpen}
      onOpenChange={(e) => {
        if (!e.open) onClose();
      }}
      size="xl"
      initialFocusEl={() => searchInputRef.current}
    >
      <DialogContent maxW="1200px" width="90vw">
        <DialogHeader marginRight={4}>
          <DialogTitle as="h2">Add a Feed</DialogTitle>
        </DialogHeader>
        <DialogCloseTrigger />
        <DialogBody ref={modalBodyRef} pb={6} overflowY="auto" maxH="70vh">
          <VisuallyHidden role="status" aria-live="polite" aria-atomic="true">
            {categoryAnnouncement}
          </VisuallyHidden>
          <Stack gap={4}>
            <FeedLimitBar />
            <FeedDiscoverySearchInput state={searchState} />
            <Text fontSize="sm" color="fg.muted">
              Don&apos;t see what you&apos;re looking for? Try pasting a website
              URL above - many sites have feeds we can detect.
            </Text>
            <Tabs.Root
              value={selectedCategory ?? ALL_TAB_VALUE}
              onValueChange={(e) => handleTabChange(e.value)}
              activationMode="manual"
              colorPalette="brand"
              variant="enclosed"
              fitted
              size="sm"
            >
              {(data?.feeds ?? []).length > 0 && (
                <CategoryPills
                  categories={data?.categories ?? []}
                  isSearchActive={isSearchActive}
                />
              )}
              {isFetching && !isSearchActive && (
                <Box aria-busy="true" aria-hidden="true">
                  <Stack gap={2}>
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <Skeleton key={i} height="64px" borderRadius="l3" />
                    ))}
                  </Stack>
                </Box>
              )}
              {!!error && !isFetching && (
                <Alert status="error">
                  Failed to load feeds.{" "}
                  <Button
                    variant="plain"
                    onClick={() => refetch()}
                    colorPalette="brand"
                  >
                    Retry
                  </Button>
                </Alert>
              )}
              {/* key forces remount when the searched term changes so Google Translate processes
                new content as fresh DOM nodes. Keyed on activeQuery only: including validationStatus
                would remount the subtree on every error->idle->loading->success transition, which
                unmounts the connect prompt mid-retry and drops the resulting feed card. */}
              {isSearchActive && (
                <Box
                  key={searchState.activeQuery}
                  as="section"
                  aria-label="Feed list"
                  opacity={isAtLimit ? 0.85 : 1}
                >
                  <FeedDiscoverySearchResults state={searchState} />
                </Box>
              )}
              {/* key forces a full remount when category changes. Google Translate
                does not re-translate text when React replaces children inside an already-translated
                container; remounting creates fresh DOM nodes that Google Translate picks up. */}
              {!isSearchActive && data && !isFetching && !error && (
                <Tabs.Content
                  key={selectedCategory ?? ALL_TAB_VALUE}
                  value={selectedCategory ?? ALL_TAB_VALUE}
                  opacity={isAtLimit ? 0.85 : 1}
                >
                  {selectedCategory === undefined ? (
                    <Stack gap={6}>
                      {highlights.map(({ category, feeds }) => {
                        const headingId = `highlights-heading-${category.id}`;

                        return (
                          <Box
                            as="section"
                            key={category.id}
                            aria-labelledby={headingId}
                            display="grid"
                            gridTemplateColumns="1fr auto"
                            gridTemplateRows="auto auto"
                            gap={3}
                          >
                            <Heading
                              as="h3"
                              size="sm"
                              id={headingId}
                              gridColumn="1"
                              gridRow="1"
                              alignSelf="center"
                            >
                              {category.label}
                            </Heading>
                            <SimpleGrid
                              as="ul"
                              role="list"
                              aria-label={`${category.label} feeds`}
                              columns={{ base: 1, md: 3 }}
                              gap={4}
                              gridColumn="1 / -1"
                              gridRow="2"
                              listStyleType="none"
                            >
                              {feeds.map((feed) => {
                                const cardProps = getFeedCardPropsFromState(
                                  feedActionStates,
                                  feed.id,
                                  isAtLimit,
                                );

                                return (
                                  <Box as="li" key={feed.id}>
                                    <FeedCard
                                      feed={feed}
                                      state={cardProps.state}
                                      onAdd={() => onAdd(feed)}
                                      onRemove={
                                        onRemove
                                          ? () => onRemove(feed.id)
                                          : undefined
                                      }
                                      errorMessage={cardProps.errorMessage}
                                      errorCode={cardProps.errorCode}
                                      isCurated
                                      showPopularBadge={false}
                                      showDomain={false}
                                      hideActions
                                      feedSettingsUrl={
                                        cardProps.feedSettingsUrl
                                      }
                                    />
                                  </Box>
                                );
                              })}
                            </SimpleGrid>
                            <Button
                              variant="plain"
                              size="sm"
                              gridColumn="2"
                              gridRow="1"
                              aria-label={`See all ${category.label} feeds`}
                              onClick={() => handleSeeAll(category.id)}
                            >
                              See all &rarr;
                            </Button>
                          </Box>
                        );
                      })}
                    </Stack>
                  ) : (
                    <Box>
                      <Stack
                        as="ul"
                        role="list"
                        aria-label={`${selectedCategoryLabel} feeds, showing ${Math.min(
                          visibleCount,
                          totalFeeds,
                        )} of ${totalFeeds}`}
                        gap={2}
                        listStyleType="none"
                      >
                        {visibleFeeds.map((feed, index) => {
                          const cardProps = getFeedCardPropsFromState(
                            feedActionStates,
                            feed.id,
                            isAtLimit,
                          );

                          return (
                            <Box
                              as="li"
                              key={feed.id}
                              data-category-feed-index={index}
                            >
                              <FeedCard
                                feed={feed}
                                state={cardProps.state}
                                onAdd={() => onAdd(feed)}
                                onRemove={
                                  onRemove ? () => onRemove(feed.id) : undefined
                                }
                                errorMessage={cardProps.errorMessage}
                                errorCode={cardProps.errorCode}
                                isCurated
                                feedSettingsUrl={cardProps.feedSettingsUrl}
                                previewEnabled
                                wrapDescription
                              />
                            </Box>
                          );
                        })}
                      </Stack>
                      {totalFeeds > BATCH_SIZE && (
                        <Text
                          aria-live="polite"
                          fontSize="sm"
                          color="fg.muted"
                          mt={3}
                          textAlign="center"
                        >
                          Showing {Math.min(visibleCount, totalFeeds)} of{" "}
                          {totalFeeds} feeds
                        </Text>
                      )}
                      {hasMore && (
                        <Button
                          mt={3}
                          onClick={handleShowMore}
                          variant="outline"
                          width="full"
                        >
                          Show more
                        </Button>
                      )}
                    </Box>
                  )}
                </Tabs.Content>
              )}
            </Tabs.Root>
          </Stack>
        </DialogBody>
      </DialogContent>
    </DialogRoot>
  );
};
