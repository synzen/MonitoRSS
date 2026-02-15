import { SearchIcon } from "@chakra-ui/icons";
import {
  Box,
  Button,
  ButtonGroup,
  Center,
  Flex,
  FormControl,
  FormErrorMessage,
  FormLabel,
  HStack,
  IconButton,
  Input,
  InputGroup,
  InputLeftElement,
  Kbd,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalOverlay,
  Radio,
  RadioGroup,
  Spinner,
  Stack,
  Text,
  chakra,
} from "@chakra-ui/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useUserFeedsInfinite } from "../../features/feed/hooks/useUserFeedsInfinite";

const LIMIT = 20;

const FeedRadioItem = ({
  feedId,
  title,
  link,
  isChecked,
  onChange,
}: {
  feedId: string;
  title: string;
  link: string;
  isChecked: boolean;
  onChange: () => void;
}) => {
  return (
    <Box as="li" listStyleType="none">
      <Box
        px={4}
        py={4}
        bg={isChecked ? "blue.700" : "whiteAlpha.200"}
        borderRadius="md"
        mt={3}
        cursor="pointer"
        borderLeft={isChecked ? "4px solid" : "none"}
        borderLeftColor="blue.500"
        onClick={onChange}
        _hover={{
          outline: "2px solid",
          outlineColor: "blue.400",
        }}
        _focus={{
          outline: "2px solid",
          outlineColor: "blue.500",
        }}
      >
        <Radio
          id={`feed-${feedId}`}
          isChecked={isChecked}
          value={feedId}
          colorScheme="blue"
          w="100%"
          onChange={onChange}
          overflow="hidden"
        >
          <Box overflow="hidden" ml={2}>
            <Text fontWeight={600}>{title}</Text>
            <Text
              fontSize="sm"
              color="whiteAlpha.700"
              whiteSpace="nowrap"
              overflow="hidden"
              textOverflow="ellipsis"
            >
              {link}
            </Text>
          </Box>
        </Radio>
      </Box>
    </Box>
  );
};

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

interface SelectFeedModalProps {
  onFeedSelected?: (feedId: string, feedTitle: string, feedUrl: string) => void;
  isOpen?: boolean;
  onClose?: () => void;
  finalFocusRef: React.RefObject<HTMLButtonElement>;
}

export const SelectFeedModal = ({
  onFeedSelected,
  isOpen: isOpenProp,
  onClose: onCloseProp,
  finalFocusRef,
}: SelectFeedModalProps) => {
  const [isOpenInternal, setIsOpenInternal] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [selectedFeedId, setSelectedFeedId] = useState<string>("");
  const [isError, setIsError] = useState(false);

  // Use either controlled or uncontrolled open state
  const isOpen = isOpenProp !== undefined ? isOpenProp : isOpenInternal;
  const {
    data: feeds,
    setSearch,
    fetchStatus,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
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

  const handleSearch = (query: string) => {
    setSearchInput(query);
    debouncedSetSearch(query);
  };

  const handleSelectFeed = () => {
    if (!selectedFeedId) {
      setIsError(true);

      return;
    }

    // Find the selected feed in the data to get its title and URL
    const selectedFeed = feeds?.pages
      .flatMap((page) => page.results)
      .find((feed) => feed.id === selectedFeedId);

    if (onFeedSelected && selectedFeed) {
      onFeedSelected(selectedFeedId, selectedFeed.title, selectedFeed.url);
    }

    handleClose();
  };

  const handleClose = () => {
    if (onCloseProp) {
      onCloseProp(); // Use provided onClose if available
    } else {
      setIsOpenInternal(false); // Fall back to internal state
    }

    setSelectedFeedId("");
    setIsError(false);
  };

  useEffect(() => {
    // Reset error when a feed is selected
    if (selectedFeedId) {
      setIsError(false);
    }
  }, [selectedFeedId]);

  useEffect(() => {
    if (!isOpen) {
      setSearchInput("");
      setSearch("");
      setSelectedFeedId("");
      setIsError(false);
    }
  }, [isOpen]);

  useEffect(() => {
    // listen for ctrl k
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key === "k") {
        event.preventDefault();

        // Only toggle if we're using internal state
        if (isOpenProp === undefined) {
          setIsOpenInternal((prev) => !prev);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpenProp]);

  const isEmpty = !feeds?.pages?.[0]?.total;
  const allFeeds = feeds?.pages.flatMap((item) => item.results) || [];

  return (
    <div>
      {/* Only show trigger buttons when not in controlled mode */}
      {isOpenProp === undefined && (
        <>
          <Button
            variant="outline"
            leftIcon={<SearchIcon />}
            color="whiteAlpha.700"
            fontWeight="normal"
            w={400}
            display={["none", "none", "flex"]}
            justifyContent="flex-start"
            alignItems="center"
            onClick={() => setIsOpenInternal(true)}
          >
            <HStack justifyContent="space-between" w="100%" alignItems="center">
              <Text>Navigate to my feeds</Text>
              <chakra.div mb={1}>
                <Kbd>Ctrl</Kbd> + <Kbd>K</Kbd>
              </chakra.div>
            </HStack>
          </Button>
          <IconButton
            variant="outline"
            aria-label="Navigate to my feeds"
            icon={<SearchIcon />}
            color="whiteAlpha.700"
            fontWeight="normal"
            display={["flex", "flex", "none"]}
            onClick={() => setIsOpenInternal(true)}
          />
        </>
      )}
      <Modal
        isOpen={isOpen}
        onClose={handleClose}
        size="xl"
        initialFocusRef={searchInputRef}
        finalFocusRef={finalFocusRef}
      >
        <ModalOverlay />
        <ModalContent>
          <ModalBody py={0} px={0}>
            <Stack>
              <HStack>
                <header>
                  <Text size="lg" fontWeight="semibold" px={4} pt={4}>
                    Select a feed
                  </Text>
                </header>
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
                    placeholder="Search your feeds"
                    onChange={(e) => handleSearch(e.target.value)}
                    value={searchInput}
                    aria-label="Search your feeds"
                  />
                </InputGroup>
              </HStack>
              <FormControl isInvalid={isError} px={4} mb={3}>
                <FormLabel id="feed-selection-group" srOnly>
                  Select a feed
                </FormLabel>
                <Box
                  bg="gray.700"
                  rounded="md"
                  aria-live="polite"
                  overflow="auto"
                  maxHeight={400}
                  border="1px solid"
                  borderColor="whiteAlpha.300"
                >
                  <Stack spacing={0}>
                    {fetchStatus === "fetching" && !allFeeds.length && (
                      <Center py={4}>
                        <Spinner />
                      </Center>
                    )}
                    {(fetchStatus === "idle" ||
                      (fetchStatus === "fetching" && allFeeds.length > 0)) &&
                      !isEmpty && (
                        <RadioGroup
                          value={selectedFeedId}
                          onChange={setSelectedFeedId}
                          role="radiogroup"
                          aria-labelledby="feed-selection-group"
                        >
                          <Stack as="ul" spacing={0} px={4}>
                            {allFeeds?.map((feed) => (
                              <FeedRadioItem
                                key={feed.id}
                                feedId={feed.id}
                                title={feed.title}
                                link={feed.url}
                                isChecked={selectedFeedId === feed.id}
                                onChange={() => setSelectedFeedId(feed.id)}
                              />
                            ))}
                          </Stack>
                        </RadioGroup>
                      )}
                    {fetchStatus === "idle" && isEmpty && (
                      <Center py={4}>
                        <Text color="whiteAlpha.700">
                          No feeds found. Try adjusting your search.
                        </Text>
                      </Center>
                    )}
                    {!isEmpty && (
                      <Flex width="full" direction="column" align="center" gap={2} p={2}>
                        <Text color="whiteAlpha.700" fontSize="sm" textAlign="center">
                          Viewed {allFeeds.length} of {feeds?.pages[0]?.total || 0} feeds
                        </Text>
                        <Button
                          onClick={() => {
                            if (hasNextPage && !isFetchingNextPage) {
                              fetchNextPage();
                            }
                          }}
                          variant="outline"
                          size="sm"
                          width="full"
                          maxW="300px"
                          isLoading={isFetchingNextPage}
                          loadingText="Loading more..."
                          aria-disabled={!hasNextPage || isFetchingNextPage}
                        >
                          {hasNextPage ? "Load more feeds" : "All feeds loaded"}
                        </Button>
                      </Flex>
                    )}
                  </Stack>
                </Box>
                {isError && <FormErrorMessage>Please select a feed to continue</FormErrorMessage>}
              </FormControl>
              {/* Selected Feed Summary Section - Always visible */}
              <Box px={4} mb={4}>
                <Text fontWeight="medium" mb={1}>
                  Selected Feed
                </Text>
                <Box
                  p={3}
                  bg="whiteAlpha.100"
                  borderRadius="md"
                  borderLeft={selectedFeedId ? "4px solid" : "none"}
                  borderLeftColor="blue.400"
                  transition="all 0.2s"
                  minHeight="70px"
                  display="flex"
                  flexDirection="column"
                  justifyContent="center"
                >
                  {!selectedFeedId ? (
                    <Text color="whiteAlpha.700" textAlign="center">
                      No feed selected. Please select a feed from the list above.
                    </Text>
                  ) : (
                    (() => {
                      const selectedFeed = allFeeds.find((feed) => feed.id === selectedFeedId);

                      if (!selectedFeed) {
                        return (
                          <Text color="whiteAlpha.700" textAlign="center">
                            Loading selected feed...
                          </Text>
                        );
                      }

                      return (
                        <>
                          <Text fontWeight="semibold">{selectedFeed.title}</Text>
                          <Text
                            fontSize="sm"
                            color="whiteAlpha.800"
                            whiteSpace="nowrap"
                            overflow="hidden"
                            textOverflow="ellipsis"
                            title={selectedFeed.url}
                            _hover={{
                              textDecoration: "underline",
                              cursor: "help",
                            }}
                          >
                            {selectedFeed.url}
                          </Text>
                        </>
                      );
                    })()
                  )}
                </Box>
              </Box>
            </Stack>
          </ModalBody>
          <ModalFooter>
            <ButtonGroup spacing={3}>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                colorScheme="blue"
                onClick={handleSelectFeed}
                isDisabled={fetchStatus === "fetching"}
              >
                Select
              </Button>
            </ButtonGroup>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
};
