import {
  Box,
  Button,
  Center,
  Flex,
  HStack,
  IconButton,
  Input,
  InputGroup,
  Spinner,
  Stack,
  Text,
  chakra,
} from "@chakra-ui/react";
import { FaMagnifyingGlass, FaXmark } from "react-icons/fa6";
import { useEffect, useState } from "react";
import { useUserFeedsInfinite } from "../../hooks/useUserFeedsInfinite";
import { InlineErrorAlert, Panel } from "../../../../components";
import { Checkbox } from "@/components/ui/checkbox";

interface Props {
  selectedIds: string[];
  onSelectedIdsChange: (ids: string[]) => void;
  isSelectedAll: boolean;
  onSelectAll: (total: number, search: string, isChecked?: boolean) => void;
  excludedIds: string[];
  onExcludedIdsChange: (ids: string[]) => void;
  description: string;
}

const LIMIT = 25;

export const SelectableUserFeedList = ({
  isSelectedAll,
  onSelectAll,
  selectedIds,
  onSelectedIdsChange,
  excludedIds,
  onExcludedIdsChange,
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

  const isMasterIndeterminate = isSelectedAll ? excludedIds.length > 0 : selectedIds.length > 0;

  useEffect(() => {
    if (isSelectedAll) {
      onSelectAll(totalCount || 0, search, true);
    }
  }, [isSelectedAll, totalCount, search]);

  return (
    <Stack gap={2}>
      <legend>
        <Stack gap={2}>
          <Text fontWeight="semibold" textStyle="sm">
            Target Feeds
          </Text>
          <Text>{description}</Text>
        </Stack>
      </legend>
      <Stack gap={1} mt={1}>
        <HStack>
          <InputGroup
            startElement={<FaMagnifyingGlass />}
            endElement={
              search && !isFetching ? (
                <IconButton
                  aria-label="Clear search"
                  size="sm"
                  variant="plain"
                  color="fg.muted"
                  onClick={() => {
                    setSearchInput("");
                    setSearch("");
                  }}
                >
                  <FaXmark />
                </IconButton>
              ) : search && isFetching ? (
                <Spinner size="sm" />
              ) : undefined
            }
          >
            <Input
              placeholder="Search for target feeds"
              onChange={(e) => setSearchInput(e.target.value)}
              value={searchInput}
              aria-label="Search for target feeds"
              required={false}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  setSearch(searchInput);
                }
              }}
            />
          </InputGroup>
          <Button
            onClick={() => {
              if (isFetching) {
                return;
              }

              setSearch(searchInput);
            }}
            aria-disabled={isFetching}
            aria-busy={isFetching}
          >
            <FaMagnifyingGlass />
            Search
          </Button>
        </HStack>
        <Panel maxHeight={350} overflow="auto">
          <Stack pb={3}>
            <Box bg="bg.emphasized" py={2} px={4} position="sticky" top={0} zIndex={1}>
              <Checkbox
                w="full"
                onCheckedChange={(details) =>
                  onSelectAll(totalCount || 0, search, !!details.checked)
                }
                checked={isMasterIndeterminate ? "indeterminate" : isSelectedAll}
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
                          onCheckedChange={(details) => {
                            if (isSelectedAll) {
                              if (!details.checked && !excludedIds.includes(userFeed.id)) {
                                onExcludedIdsChange([...excludedIds, userFeed.id]);
                              } else if (details.checked && excludedIds.includes(userFeed.id)) {
                                onExcludedIdsChange(excludedIds.filter((id) => id !== userFeed.id));
                              }
                            } else if (details.checked && !selectedIds.includes(userFeed.id)) {
                              onSelectedIdsChange([...selectedIds, userFeed.id]);
                            } else if (!details.checked && selectedIds.includes(userFeed.id)) {
                              onSelectedIdsChange(selectedIds.filter((id) => id !== userFeed.id));
                            }
                          }}
                          checked={
                            isSelectedAll
                              ? !excludedIds.includes(userFeed.id)
                              : selectedIds.includes(userFeed.id)
                          }
                          required={false}
                        >
                          <chakra.span ml={2} display="block" fontSize="sm" fontWeight={600}>
                            {userFeed.title}
                          </chakra.span>
                          <chakra.span
                            ml={2}
                            display="block"
                            color="fg.muted"
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
              <Text color="fg.muted" fontSize="sm" textAlign="center" mt={6} px={4}>
                Viewed {fetchedSoFarCount} of {totalCount} feeds
              </Text>
            )}
            {totalCount !== undefined && totalCount === 0 && (
              <Text color="fg.muted" fontSize="sm" textAlign="center" mt={0} px={4} py={3}>
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
        </Panel>
      </Stack>
    </Stack>
  );
};
