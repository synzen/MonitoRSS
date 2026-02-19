import { useState, useRef, useCallback, useEffect } from "react";
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  Stack,
  Box,
  Text,
  Button,
  SimpleGrid,
  Heading,
  Spinner,
  Alert,
  AlertIcon,
  AlertDescription,
} from "@chakra-ui/react";
import { FeedCard } from "../FeedCard";
import { FeedLimitBar } from "../FeedLimitBar";
import {
  useFeedDiscoverySearchState,
  FeedDiscoverySearchInput,
  FeedDiscoverySearchResults,
} from "../FeedDiscoverySearch";
import { CategoryPills } from "../CategoryPills";
import { useCuratedFeeds } from "../../hooks";
import type { CuratedFeed } from "../../types";
import type { FeedActionState } from "../../types/FeedActionState";
import { getFeedCardPropsFromState } from "../../types/FeedActionState";

interface BrowseFeedsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCategory?: string;
  feedActionStates: Record<string, FeedActionState>;
  isAtLimit: boolean;
  onAdd: (feed: CuratedFeed) => void;
  onFeedAdded?: (feedId: string, feedUrl: string) => void;
}

const BATCH_SIZE = 20;

export const BrowseFeedsModal = ({
  isOpen,
  onClose,
  initialCategory,
  feedActionStates,
  isAtLimit,
  onAdd,
  onFeedAdded,
}: BrowseFeedsModalProps) => {
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(initialCategory);
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
    setIsSearchActive(false);
  }

  if (!isOpen && prevIsOpenRef.current) {
    prevIsOpenRef.current = false;
  }

  const { data, getHighlightFeeds, isLoading, error, refetch } = useCuratedFeeds(
    selectedCategory ? { category: selectedCategory } : undefined
  );

  const handleSearchChange = useCallback((query: string) => {
    setIsSearchActive(query.length > 0);
  }, []);

  const searchState = useFeedDiscoverySearchState({
    feedActionStates,
    isAtLimit,
    onAdd,
    searchInputRef,
    onSearchChange: handleSearchChange,
    onFeedAdded,
  });

  useEffect(() => {
    if (isOpen) {
      searchState.handleClear();
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
          `[data-category-feed-index="${lastIndex}"] button`
        ) as HTMLElement | null;
        lastItem?.focus();
      } else {
        const nextItem = document.querySelector(
          `[data-category-feed-index="${previousCount}"] button`
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
    (data?.categories ?? []).find((c) => c.id === selectedCategory)?.label || selectedCategory;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="6xl" initialFocusRef={searchInputRef}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader as="h2">Add a Feed</ModalHeader>
        <ModalCloseButton />
        <ModalBody ref={modalBodyRef} pb={6} overflowY="auto" maxH="70vh">
          <Stack spacing={4}>
            <FeedLimitBar />
            <FeedDiscoverySearchInput state={searchState} />
            <Text fontSize="sm" color="gray.400">
              Don&apos;t see what you&apos;re looking for? Try pasting a website URL above — many
              sites have feeds we can detect.
            </Text>
            <Box as="nav" aria-label="Feed categories">
              <CategoryPills
                categories={data?.categories ?? []}
                selectedCategory={selectedCategory}
                onSelect={handleCategorySelect}
                isSearchActive={isSearchActive}
              />
            </Box>
            {isLoading && !isSearchActive && (
              <Box display="flex" justifyContent="center" py={8}>
                <Spinner size="lg" aria-label="Loading feeds" />
              </Box>
            )}
            {!!error && !isLoading && (
              <Alert status="error">
                <AlertIcon />
                <AlertDescription>
                  Failed to load feeds.{" "}
                  <Button variant="link" onClick={() => refetch()} colorScheme="blue">
                    Retry
                  </Button>
                </AlertDescription>
              </Alert>
            )}
            {isSearchActive && (
              <Box as="section" aria-label="Feed list" opacity={isAtLimit ? 0.85 : 1}>
                <FeedDiscoverySearchResults state={searchState} />
              </Box>
            )}
            {!isSearchActive && data && !isLoading && !error && (
              <Box as="section" aria-label="Feed list" opacity={isAtLimit ? 0.85 : 1}>
                {selectedCategory === undefined ? (
                  <Stack spacing={6}>
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
                            spacing={4}
                            gridColumn="1 / -1"
                            gridRow="2"
                            listStyleType="none"
                          >
                            {feeds.map((feed) => {
                              const cardProps = getFeedCardPropsFromState(
                                feedActionStates,
                                feed.url,
                                isAtLimit
                              );

                              return (
                                <Box as="li" key={feed.url}>
                                  <FeedCard
                                    feed={feed}
                                    state={cardProps.state}
                                    onAdd={() => onAdd(feed)}
                                    errorMessage={cardProps.errorMessage}
                                    errorCode={cardProps.errorCode}
                                    isCurated
                                    showPopularBadge={false}
                                    showDomain={false}
                                    hideActions
                                    feedSettingsUrl={cardProps.feedSettingsUrl}
                                  />
                                </Box>
                              );
                            })}
                          </SimpleGrid>
                          <Button
                            variant="link"
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
                        totalFeeds
                      )} of ${totalFeeds}`}
                      spacing={2}
                      listStyleType="none"
                    >
                      {visibleFeeds.map((feed, index) => {
                        const cardProps = getFeedCardPropsFromState(
                          feedActionStates,
                          feed.url,
                          isAtLimit
                        );

                        return (
                          <Box as="li" key={feed.url} data-category-feed-index={index}>
                            <FeedCard
                              feed={feed}
                              state={cardProps.state}
                              onAdd={() => onAdd(feed)}
                              errorMessage={cardProps.errorMessage}
                              errorCode={cardProps.errorCode}
                              isCurated
                              feedSettingsUrl={cardProps.feedSettingsUrl}
                              previewEnabled
                            />
                          </Box>
                        );
                      })}
                    </Stack>
                    {totalFeeds > BATCH_SIZE && (
                      <Text
                        aria-live="polite"
                        fontSize="sm"
                        color="gray.400"
                        mt={3}
                        textAlign="center"
                      >
                        Showing {Math.min(visibleCount, totalFeeds)} of {totalFeeds} feeds
                      </Text>
                    )}
                    {hasMore && (
                      <Button mt={3} onClick={handleShowMore} variant="outline" width="full">
                        Show more
                      </Button>
                    )}
                  </Box>
                )}
              </Box>
            )}
          </Stack>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};
