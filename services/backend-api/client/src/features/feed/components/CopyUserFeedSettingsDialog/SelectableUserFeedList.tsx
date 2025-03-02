import {
  Box,
  Button,
  Center,
  Checkbox,
  Flex,
  HStack,
  IconButton,
  Input,
  InputGroup,
  InputLeftElement,
  InputRightElement,
  Spinner,
  Stack,
  Text,
  chakra,
} from "@chakra-ui/react";
import { CloseIcon, SearchIcon } from "@chakra-ui/icons";
import { useState } from "react";
import { useUserFeedsInfinite } from "../../hooks/useUserFeedsInfinite";
import { InlineErrorAlert } from "../../../../components";

interface Props {
  selectedIds: string[];
  onSelectedIdsChange: (ids: string[]) => void;
}

export const SelectableUserFeedList = ({ selectedIds, onSelectedIdsChange }: Props) => {
  const [searchInput, setSearchInput] = useState("");
  const {
    data,
    error,
    status,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    setSearch,
    isFetching,
    search,
  } = useUserFeedsInfinite({
    limit: 10,
  });
  const totalCount = data?.pages[0].total;

  const fetchedSoFarCount = data?.pages.reduce((acc, page) => acc + page.results.length, 0) ?? 0;

  const offsets = data?.pageParams as Array<number | undefined>; // [undefined, 10, 20] etc
  const latestOffset = offsets?.[offsets.length - 1] || 0;

  return (
    <Stack spacing={1}>
      <Box srOnly aria-live="polite">
        {!!offsets && (
          <span>
            Finished loading available target feeds ${latestOffset} to ${latestOffset + 10} out of $
            {totalCount}
          </span>
        )}
        {status === "loading" && <span>Loading available target feeds</span>}
      </Box>
      <HStack>
        <InputGroup>
          <InputLeftElement>
            <SearchIcon />
          </InputLeftElement>
          <Input
            bg="gray.800"
            placeholder="Search for target feeds"
            onChange={(e) => setSearchInput(e.target.value)}
            value={searchInput}
            aria-label="Search for target feeds"
            isInvalid={false}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                setSearch(searchInput);
              }
            }}
          />
          {search && !isFetching && (
            <InputRightElement>
              <IconButton
                aria-label="Clear search"
                icon={<CloseIcon color="gray.400" />}
                size="sm"
                variant="link"
                onClick={() => {
                  setSearchInput("");
                  setSearch("");
                }}
              />
            </InputRightElement>
          )}
          {search && isFetching && (
            <InputRightElement>
              <Spinner size="sm" />
            </InputRightElement>
          )}
        </InputGroup>
        <Button
          leftIcon={<SearchIcon />}
          onClick={() => {
            if (isFetching) {
              return;
            }

            setSearch(searchInput);
          }}
          aria-disabled={isFetching}
          aria-busy={isFetching}
        >
          Search
        </Button>
      </HStack>
      <Stack
        px={4}
        py={3}
        borderRadius="md"
        maxHeight={350}
        border="1px"
        borderColor="gray.700"
        overflow="auto"
        bg="gray.800"
      >
        <Stack as="ul" listStyleType="none" gap={4}>
          {data?.pages.map((page) => {
            if (!page.results.length) {
              return null;
            }

            return (
              <>
                {page.results.map((userFeed) => (
                  <Box key={`feed-${userFeed.id}`} as="li">
                    <Checkbox
                      width="100%"
                      onChange={(e) => {
                        if (e.target.checked && !selectedIds.includes(userFeed.id)) {
                          onSelectedIdsChange([...selectedIds, userFeed.id]);
                        } else if (!e.target.checked && selectedIds.includes(userFeed.id)) {
                          onSelectedIdsChange(selectedIds.filter((id) => id !== userFeed.id));
                        }
                      }}
                      isChecked={selectedIds.includes(userFeed.id)}
                    >
                      <chakra.span ml={2} display="block" fontSize="sm" fontWeight={600}>
                        {userFeed.title}
                      </chakra.span>
                      <chakra.span
                        ml={2}
                        display="block"
                        color="whiteAlpha.700"
                        fontSize="sm"
                        whiteSpace="break-spaces"
                        wordBreak="break-all"
                      >
                        {userFeed.url}
                      </chakra.span>
                    </Checkbox>
                  </Box>
                ))}
              </>
            );
          })}
        </Stack>
        {status === "loading" && (
          <Center>
            <Spinner margin={4} />
          </Center>
        )}
        {error && <InlineErrorAlert title="Failed to list feeds" description={error.message} />}
        {totalCount !== undefined && totalCount > 0 && (
          <Text color="whiteAlpha.700" fontSize="sm" textAlign="center" mt={6}>
            Viewed {fetchedSoFarCount} of {totalCount} feeds
          </Text>
        )}
        {totalCount !== undefined && totalCount === 0 && (
          <Text color="whiteAlpha.700" fontSize="sm" textAlign="center" mt={0}>
            No feeds found
          </Text>
        )}
        <Flex width="full">
          <Button
            hidden={!hasNextPage}
            onClick={() => fetchNextPage()}
            variant="outline"
            size="sm"
            width="full"
            aria-disabled={isFetchingNextPage || !hasNextPage}
          >
            <span>Load more feeds</span>
          </Button>
        </Flex>
      </Stack>
    </Stack>
  );
};
