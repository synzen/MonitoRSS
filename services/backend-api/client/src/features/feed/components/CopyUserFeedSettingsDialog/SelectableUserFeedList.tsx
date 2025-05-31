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
import { useEffect, useState } from "react";
import { useUserFeedsInfinite } from "../../hooks/useUserFeedsInfinite";
import { InlineErrorAlert } from "../../../../components";

interface Props {
  selectedIds: string[];
  onSelectedIdsChange: (ids: string[]) => void;
  isSelectedAll: boolean;
  onSelectAll: (total: number, search: string, isChecked?: boolean) => void;
  description: string;
}

const LIMIT = 25;

export const SelectableUserFeedList = ({
  isSelectedAll,
  onSelectAll,
  selectedIds,
  onSelectedIdsChange,
  description,
}: Props) => {
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
    limit: LIMIT,
  });
  const totalCount = data?.pages[0].total;

  const fetchedSoFarCount = data?.pages.reduce((acc, page) => acc + page.results.length, 0) ?? 0;

  useEffect(() => {
    if (isSelectedAll) {
      onSelectAll(totalCount || 0, search, true);
    }
  }, [isSelectedAll, totalCount, search]);

  return (
    <Stack spacing={2}>
      <legend>
        <Stack spacing={2}>
          <Text fontWeight="semibold" size="sm">
            Target Feeds
          </Text>
          <Text>{description}</Text>
        </Stack>
      </legend>
      <Stack spacing={1} mt={1}>
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
              isRequired={false}
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
          pb={3}
          borderRadius="md"
          maxHeight={350}
          border="1px"
          borderColor="gray.700"
          overflow="auto"
          bg="gray.800"
        >
          <Box bg="blue.700" py={2} px={4} position="sticky" top={0} zIndex={1}>
            <Checkbox
              w="full"
              onChange={(e) =>
                onSelectAll(totalCount || 0, search, (e.target as HTMLInputElement).checked)
              }
              isChecked={isSelectedAll}
            >
              Select all {totalCount || 0} matching feeds
            </Checkbox>
          </Box>
          <Stack as="ul" listStyleType="none" gap={4} px={4}>
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
                        isChecked={isSelectedAll || selectedIds.includes(userFeed.id)}
                        isRequired={false}
                        isDisabled={isSelectedAll}
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
            <Center px={4} py={3}>
              <Spinner margin={4} />
            </Center>
          )}
          {error && (
            <Box px={4} py={3}>
              <InlineErrorAlert title="Failed to list feeds" description={error.message} />
            </Box>
          )}
          {totalCount !== undefined && totalCount > 0 && (
            <Text color="whiteAlpha.700" fontSize="sm" textAlign="center" mt={6} px={4}>
              Viewed {fetchedSoFarCount} of {totalCount} feeds
            </Text>
          )}
          {totalCount !== undefined && totalCount === 0 && (
            <Text color="whiteAlpha.700" fontSize="sm" textAlign="center" mt={0} px={4} py={3}>
              No feeds found
            </Text>
          )}
          <Flex width="full" px={4}>
            <Button
              hidden={!hasNextPage}
              onClick={() => fetchNextPage()}
              variant="outline"
              size="sm"
              width="full"
              aria-disabled={isFetchingNextPage || !hasNextPage}
            >
              <span>View more feeds</span>
            </Button>
          </Flex>
        </Stack>
      </Stack>
    </Stack>
  );
};
