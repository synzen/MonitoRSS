import { SearchIcon } from "@chakra-ui/icons";
import {
  Box,
  Button,
  Center,
  HStack,
  IconButton,
  Input,
  InputGroup,
  InputLeftElement,
  ListItem,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalOverlay,
  Spinner,
  Stack,
  Text,
  UnorderedList,
} from "@chakra-ui/react";
import { Link } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { useUserFeedsInfinite } from "../../features/feed/hooks/useUserFeedsInfinite";
import { pages } from "../../constants";

const LIMIT = 20;

const SearchResultItem = ({
  feedId,
  title,
  link,
  setSize,
  position,
  onClicked,
}: {
  feedId: string;
  title: string;
  link: string;
  setSize: number;
  position: number;
  onClicked?: () => void;
}) => {
  return (
    <ListItem
      listStyleType="none"
      aria-setsize={setSize}
      aria-posinset={position}
      onClick={onClicked}
    >
      <HStack
        as={Link}
        to={pages.userFeed(feedId)}
        px={4}
        py={4}
        bg="gray.800"
        borderRadius="md"
        mt={3}
        alignItems="center"
        _hover={{
          outline: "3px solid",
          outlineColor: "blue.500",
          // backgroundColor: "blue.800",
        }}
        _focus={{
          outline: "3px solid",
          outlineColor: "blue.500",
        }}
      >
        <Box overflow="hidden">
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
      </HStack>
    </ListItem>
  );
};

function debounce(func: Function, delay: number) {
  let timeoutId: NodeJS.Timeout;

  return function cb(...args: any[]) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      func(...args);
    }, delay);
  };
}

export const SearchFeedsModal = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
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
    }
  );
  const debouncedSetSearch = useMemo(() => debounce(setSearch, 300), [setSearch]);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const handleSearch = (query: string) => {
    setSearchInput(query);
    debouncedSetSearch(query);
  };

  useEffect(() => {
    if (!isOpen) {
      setSearchInput("");
      setSearch("");
    }
  }, [isOpen]);

  const isEmpty = !feeds?.pages?.[0]?.total;
  const allFeeds = feeds?.pages.flatMap((item) => item.results) || [];

  return (
    <div>
      <Button
        variant="outline"
        leftIcon={<SearchIcon />}
        color="whiteAlpha.700"
        fontWeight="normal"
        w={400}
        display={["none", "none", "flex"]}
        justifyContent="flex-start"
        alignItems="center"
        onClick={() => setIsOpen(true)}
      >
        Navigate to my feeds
      </Button>
      <IconButton
        variant="outline"
        aria-label="Navigate to my feeds"
        icon={<SearchIcon />}
        color="whiteAlpha.700"
        fontWeight="normal"
        display={["flex", "flex", "none"]}
        onClick={() => setIsOpen(true)}
      />
      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        size="xl"
        initialFocusRef={searchInputRef}
      >
        <ModalOverlay />
        <ModalContent>
          <ModalBody py={0} px={0}>
            <Stack>
              <HStack>
                <header>
                  <Text size="lg" fontWeight="semibold" px={4} pt={4}>
                    Navigate to my feeds
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
                    // bg="gray.700"
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
                      <Spinner />
                    </Center>
                  )}
                  {fetchStatus === "idle" && !isEmpty && (
                    <UnorderedList m={0}>
                      {allFeeds?.map((feed, index) => (
                        <SearchResultItem
                          key={feed.id}
                          feedId={feed.id}
                          title={feed.title}
                          link={feed.url}
                          setSize={allFeeds.length}
                          position={index}
                          onClicked={() => setIsOpen(false)}
                        />
                      ))}
                    </UnorderedList>
                  )}
                  {fetchStatus === "idle" && isEmpty && (
                    <Center py={4}>
                      <Text color="whiteAlpha.700">No feeds found. Try adjusting your search.</Text>
                    </Center>
                  )}
                  {fetchStatus === "idle" && allFeeds.length === LIMIT && (
                    <Center>
                      <Text color="whiteAlpha.700" fontSize="sm" mt={2}>
                        Only the first {LIMIT} results are shown. Refine your search to better
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
    </div>
  );
};
