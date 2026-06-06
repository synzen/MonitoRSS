import {
  Box,
  Button,
  ButtonGroup,
  Center,
  Flex,
  HStack,
  Icon,
  IconButton,
  Input,
  InputGroup,
  Kbd,
  Spinner,
  Stack,
  Text,
  chakra,
} from "@chakra-ui/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { FaMagnifyingGlass } from "react-icons/fa6";
import { useUserFeedsInfinite } from "../../hooks/useUserFeedsInfinite";
import {
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  DialogCloseTrigger,
} from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Radio, RadioGroup } from "@/components/ui/radio";
import { PrimaryActionButton } from "@/components/PrimaryActionButton";
import { SafeLoadingButton } from "@/components/SafeLoadingButton";
import { Panel } from "@/components/Panel";

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
    <Box as="li" listStyleType="none" w="100%">
      <Box
        px={4}
        py={4}
        bg="bg.subtle"
        borderRadius="l3"
        mt={3}
        cursor="pointer"
        borderLeft="4px solid"
        borderLeftColor={isChecked ? "brandSolid" : "transparent"}
        outline={isChecked ? "2px solid" : "none"}
        outlineColor="brand.focusRing"
        onClick={onChange}
        _hover={{
          outline: "2px solid",
          outlineColor: "brand.focusRing",
        }}
        _focus={{
          outline: "2px solid",
          outlineColor: "brand.focusRing",
        }}
      >
        <Radio id={`feed-${feedId}`} value={feedId} colorPalette="brand" w="100%" overflow="hidden">
          <Box overflow="hidden" ml={2}>
            <Text fontWeight={600}>{title}</Text>
            <Text
              fontSize="sm"
              color="fg.muted"
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
            color="fg.muted"
            fontWeight="normal"
            w={400}
            display={["none", "none", "flex"]}
            justifyContent="flex-start"
            alignItems="center"
            onClick={() => setIsOpenInternal(true)}
          >
            <Icon>
              <FaMagnifyingGlass />
            </Icon>
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
            color="fg.muted"
            fontWeight="normal"
            display={["flex", "flex", "none"]}
            onClick={() => setIsOpenInternal(true)}
          >
            <FaMagnifyingGlass />
          </IconButton>
        </>
      )}
      <DialogRoot
        open={isOpen}
        onOpenChange={(e) => {
          if (!e.open) {
            handleClose();
          }
        }}
        size="xl"
        initialFocusEl={() => searchInputRef.current}
        finalFocusEl={() => finalFocusRef.current}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select a feed</DialogTitle>
          </DialogHeader>
          <DialogCloseTrigger />
          <DialogBody py={0} px={0}>
            <Stack>
              <HStack pl={4} pr={4}>
                <InputGroup startElement={<FaMagnifyingGlass />} flex={1}>
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
              <Field invalid={isError} errorText="Please select a feed to continue" px={4} mb={3}>
                <Text id="feed-selection-group" srOnly>
                  Select a feed
                </Text>
                <Box
                  bg="bg.panel"
                  rounded="l3"
                  alignSelf="stretch"
                  aria-live="polite"
                  overflow="auto"
                  maxHeight={400}
                  border="1px solid"
                  borderColor="border"
                >
                  <Stack gap={0}>
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
                          onValueChange={(details) => setSelectedFeedId(details.value ?? "")}
                          role="radiogroup"
                          aria-labelledby="feed-selection-group"
                          width="full"
                        >
                          <Stack as="ul" gap={0} px={4} width="full">
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
                        <Text color="fg.muted">No feeds found. Try adjusting your search.</Text>
                      </Center>
                    )}
                    {!isEmpty && (
                      <Flex width="full" direction="column" align="center" gap={2} p={2}>
                        <Text color="fg.muted" fontSize="sm" textAlign="center">
                          Viewed {allFeeds.length} of {feeds?.pages[0]?.total || 0} feeds
                        </Text>
                        <SafeLoadingButton
                          onClick={() => {
                            if (hasNextPage && !isFetchingNextPage) {
                              fetchNextPage();
                            }
                          }}
                          variant="outline"
                          size="sm"
                          width="full"
                          maxW="300px"
                          loading={isFetchingNextPage}
                          loadingText="Loading more..."
                          aria-disabled={!hasNextPage || isFetchingNextPage}
                        >
                          {hasNextPage ? "Load more feeds" : "All feeds loaded"}
                        </SafeLoadingButton>
                      </Flex>
                    )}
                  </Stack>
                </Box>
              </Field>
              {/* Selected Feed Summary Section - Always visible */}
              <Box px={4} mb={4}>
                <Text fontWeight="medium" mb={1}>
                  Selected Feed
                </Text>
                <Panel
                  surface="subtle"
                  p={3}
                  borderLeftWidth={selectedFeedId ? "4px" : undefined}
                  borderLeftColor={selectedFeedId ? "brandSolid" : undefined}
                  transition="all 0.2s"
                  minHeight="70px"
                  display="flex"
                  flexDirection="column"
                  justifyContent="center"
                >
                  {!selectedFeedId ? (
                    <Text color="fg.muted" textAlign="center">
                      No feed selected. Please select a feed from the list above.
                    </Text>
                  ) : (
                    (() => {
                      const selectedFeed = allFeeds.find((feed) => feed.id === selectedFeedId);

                      if (!selectedFeed) {
                        return (
                          <Text color="fg.muted" textAlign="center">
                            Loading selected feed...
                          </Text>
                        );
                      }

                      return (
                        <>
                          <Text fontWeight="semibold">{selectedFeed.title}</Text>
                          <Text
                            fontSize="sm"
                            color="fg"
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
                </Panel>
              </Box>
            </Stack>
          </DialogBody>
          <DialogFooter>
            <ButtonGroup gap={3}>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <PrimaryActionButton onClick={handleSelectFeed} disabled={fetchStatus === "fetching"}>
                Select
              </PrimaryActionButton>
            </ButtonGroup>
          </DialogFooter>
        </DialogContent>
      </DialogRoot>
    </div>
  );
};
