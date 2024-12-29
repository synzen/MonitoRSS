import {
  Box,
  Button,
  Center,
  Checkbox,
  Divider,
  Flex,
  Spinner,
  Stack,
  Text,
  chakra,
} from "@chakra-ui/react";
import { useUserFeedsInfinite } from "../../hooks/useUserFeedsInfinite";
import { InlineErrorAlert } from "../../../../components";

interface Props {
  selectedIds: string[];
  onSelectedIdsChange: (ids: string[]) => void;
}

export const SelectableUserFeedList = ({ selectedIds, onSelectedIdsChange }: Props) => {
  const { data, error, status, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useUserFeedsInfinite({
      limit: 10,
    });
  const totalCount = data?.pages[0].total;

  const fetchedSoFarCount = data?.pages.reduce((acc, page) => acc + page.results.length, 0) ?? 0;

  return (
    <Stack>
      <Stack
        px={4}
        py={3}
        borderRadius="md"
        maxHeight={350}
        border="2px"
        borderColor="gray.600"
        overflow="auto"
        bg="blackAlpha.300"
      >
        <Stack divider={<Divider />}>
          {data?.pages.map((page) => {
            if (!page.results.length) {
              return null;
            }

            return (
              <Stack gap={1} divider={<Divider />}>
                {page.results.map((userFeed) => (
                  <Box key={`feed-${userFeed.id}`}>
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
                        color="whiteAlpha.600"
                        fontSize="sm"
                        whiteSpace="nowrap"
                      >
                        {userFeed.url}
                      </chakra.span>
                    </Checkbox>
                  </Box>
                ))}
              </Stack>
            );
          })}
        </Stack>
        {status === "loading" && (
          <Center>
            <Spinner margin={4} />
          </Center>
        )}
        {error && <InlineErrorAlert title="Failed to list feeds" description={error.message} />}
        <Text color="whiteAlpha.600" fontSize="sm" textAlign="center" mt={6}>
          Viewed {fetchedSoFarCount} of {totalCount} feeds
        </Text>
        <Flex width="full">
          <Button
            hidden={!hasNextPage}
            onClick={() => fetchNextPage()}
            isLoading={isFetchingNextPage}
            variant="outline"
            size="sm"
            width="full"
          >
            Load more
          </Button>
        </Flex>
      </Stack>
    </Stack>
  );
};
