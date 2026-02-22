import { SearchIcon } from "@chakra-ui/icons";
import {
  Box,
  Button,
  Center,
  Heading,
  HStack,
  IconButton,
  Input,
  InputGroup,
  InputLeftElement,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalOverlay,
  Spinner,
  Stack,
  Text,
  Tooltip,
} from "@chakra-ui/react";
import { useNavigate } from "react-router-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useUserFeeds } from "../../features/feed/hooks/useUserFeeds";
import { useUserFeedsInfinite } from "../../features/feed/hooks/useUserFeedsInfinite";
import { pages } from "../../constants";

const LIMIT = 20;

const isMac = /Mac|iPhone|iPod|iPad/.test(navigator.platform);

function debounce(func: Function, delay: number) {
  let timeoutId: number;

  return function cb(...args: any[]) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      func(...args);
    }, delay);
  };
}

const URL_PATTERN = /^https?:\/\//;

export const SearchFeedsModal = () => {
  const { data: feedCountData } = useUserFeeds({ limit: 1, offset: 0 });
  const hasFeedsLoaded = feedCountData !== undefined;
  const hasFeeds = (feedCountData?.total ?? 0) > 0;

  const [isOpen, setIsOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const navigate = useNavigate();
  const {
    data: feeds,
    setSearch,
    fetchStatus,
  } = useUserFeedsInfinite(
    {
      limit: LIMIT,
      sort: "-createdAt",
    },
    {
      disabled: !isOpen,
    },
  );
  const debouncedSetSearch = useMemo(() => debounce(setSearch, 300), [setSearch]);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const triggerButtonRef = useRef<HTMLButtonElement>(null);
  const listboxRef = useRef<HTMLDivElement>(null);

  const allFeeds = feeds?.pages.flatMap((item) => item.results) || [];
  const isEmpty = !feeds?.pages?.[0]?.total;

  const handleSearch = (query: string) => {
    setSearchInput(query);
    setActiveIndex(-1);
    debouncedSetSearch(query);
  };

  const handleAddFeedRedirect = () => {
    setIsOpen(false);
    navigate(`/feeds?addFeed=${encodeURIComponent(searchInput)}`);
  };

  const navigateToFeed = useCallback(
    (feedId: string) => {
      setIsOpen(false);
      navigate(pages.userFeed(feedId));
    },
    [navigate],
  );

  useEffect(() => {
    if (!isOpen) {
      setSearchInput("");
      setSearch("");
      setActiveIndex(-1);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!hasFeeds) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "k") {
        event.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [hasFeeds]);

  useEffect(() => {
    if (fetchStatus === "idle" && allFeeds.length > 0) {
      setActiveIndex(0);
    }
  }, [fetchStatus, allFeeds.length]);

  useEffect(() => {
    if (activeIndex < 0) return;

    const activeOption = document.getElementById(`feed-nav-option-${activeIndex}`);

    activeOption?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const handleInputKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();

      if (allFeeds.length > 0) {
        setActiveIndex((prev) => (prev < allFeeds.length - 1 ? prev + 1 : 0));
      }
    } else if (event.key === "ArrowUp") {
      event.preventDefault();

      if (allFeeds.length > 0) {
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : allFeeds.length - 1));
      }
    } else if (event.key === "Enter") {
      event.preventDefault();

      if (activeIndex >= 0 && activeIndex < allFeeds.length) {
        navigateToFeed(allFeeds[activeIndex].id);
      }
    }
  };

  if (!hasFeedsLoaded || !hasFeeds) {
    return null;
  }

  const showResults = fetchStatus === "idle" && !isEmpty;

  return (
    <>
      <Tooltip label={`Go to feed (${isMac ? "Cmd" : "Ctrl"}+K)`}>
        <IconButton
          ref={triggerButtonRef}
          variant="ghost"
          aria-label="Search your feeds and go to one"
          icon={<SearchIcon />}
          color="whiteAlpha.600"
          // _hover={{ color: "whiteAlpha.900", bg: "whiteAlpha.200" }}
          // _focus={{ color: "whiteAlpha.900", bg: "whiteAlpha.200" }}
          size={{ base: "sm", lg: "md" }}
          onClick={() => setIsOpen(true)}
        />
      </Tooltip>
      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        size="xl"
        initialFocusRef={searchInputRef}
        finalFocusRef={triggerButtonRef}
      >
        <ModalOverlay />
        <ModalContent aria-labelledby="feed-nav-title">
          <ModalBody py={0} px={0}>
            <Stack>
              <HStack>
                <Heading as="h2" id="feed-nav-title" size="sm" fontWeight="semibold" px={4} pt={4}>
                  Go to feed
                </Heading>
                <ModalCloseButton />
              </HStack>
              <HStack pl={4} pr={4}>
                <InputGroup size="lg">
                  <InputLeftElement>
                    <SearchIcon />
                  </InputLeftElement>
                  <Input
                    ref={searchInputRef}
                    variant="flushed"
                    placeholder="Type a feed name..."
                    onChange={(e) => handleSearch(e.target.value)}
                    value={searchInput}
                    aria-label="Go to feed"
                    role="combobox"
                    aria-expanded={showResults}
                    aria-controls="feed-nav-listbox"
                    aria-activedescendant={
                      activeIndex >= 0 ? `feed-nav-option-${activeIndex}` : undefined
                    }
                    onKeyDown={handleInputKeyDown}
                  />
                </InputGroup>
              </HStack>
              <Box
                px={4}
                pb={4}
                bg="gray.700"
                rounded="md"
                aria-live="polite"
                overflow="auto"
                maxHeight={500}
              >
                <Stack>
                  {fetchStatus === "fetching" && (
                    <Center py={4}>
                      <Spinner label="Loading feeds" />
                    </Center>
                  )}
                  {fetchStatus === "idle" && !isEmpty && (
                    <Box ref={listboxRef} role="listbox" id="feed-nav-listbox">
                      {allFeeds?.map((feed, index) => (
                        <Box
                          key={feed.id}
                          id={`feed-nav-option-${index}`}
                          role="option"
                          aria-selected={index === activeIndex}
                          px={4}
                          py={4}
                          bg="whiteAlpha.200"
                          borderRadius="md"
                          mt={3}
                          cursor="pointer"
                          onClick={() => navigateToFeed(feed.id)}
                          outline={index === activeIndex ? "3px solid" : undefined}
                          outlineColor={index === activeIndex ? "blue.500" : undefined}
                          _hover={{
                            outline: "3px solid",
                            outlineColor: "blue.500",
                          }}
                        >
                          <Box overflow="hidden">
                            <Text fontWeight={600}>{feed.title}</Text>
                            <Text
                              fontSize="sm"
                              color="whiteAlpha.700"
                              whiteSpace="nowrap"
                              overflow="hidden"
                              textOverflow="ellipsis"
                            >
                              {feed.url}
                            </Text>
                          </Box>
                        </Box>
                      ))}
                    </Box>
                  )}
                  {fetchStatus === "idle" && isEmpty && (
                    <Stack py={4} spacing={3} align="center">
                      <Text color="whiteAlpha.700">No feeds found.</Text>
                      {searchInput.trim() &&
                        (URL_PATTERN.test(searchInput.trim()) ? (
                          <Stack spacing={1} align="center">
                            <Text fontSize="sm" color="whiteAlpha.700">
                              This looks like a feed URL.
                            </Text>
                            <Button
                              variant="link"
                              colorScheme="blue"
                              size="sm"
                              onClick={handleAddFeedRedirect}
                            >
                              Add it as a new feed &rarr;
                            </Button>
                          </Stack>
                        ) : (
                          <Stack spacing={1} align="center">
                            <Text fontSize="sm" color="whiteAlpha.700">
                              Can&apos;t find what you&apos;re looking for?
                            </Text>
                            <Button
                              variant="link"
                              colorScheme="blue"
                              size="sm"
                              onClick={handleAddFeedRedirect}
                            >
                              Search for new feeds to add &rarr;
                            </Button>
                          </Stack>
                        ))}
                    </Stack>
                  )}
                  {fetchStatus === "idle" && allFeeds.length === LIMIT && (
                    <Center>
                      <Text color="whiteAlpha.700" fontSize="sm" mt={2}>
                        Only the first {LIMIT} results are shown. Refine your search for better
                        results.
                      </Text>
                    </Center>
                  )}
                </Stack>
              </Box>
            </Stack>
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
};
