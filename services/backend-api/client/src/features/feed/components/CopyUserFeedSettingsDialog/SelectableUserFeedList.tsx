import { Box, Center, Checkbox, Divider, Spinner, Stack, chakra } from "@chakra-ui/react";
import { useInView } from "react-intersection-observer";
import { useCallback, useEffect } from "react";
import { useUserFeedsInfinite } from "../../hooks/useUserFeedsInfinite";
import { InlineErrorAlert } from "../../../../components";

interface Props {
  selectedIds: string[];
  onSelectedIdsChange: (ids: string[]) => void;
}

export const SelectableUserFeedList = ({ selectedIds, onSelectedIdsChange }: Props) => {
  const { ref: scrollRef, inView } = useInView();
  const { data, status, error, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useUserFeedsInfinite({
      limit: 10,
    });

  const fetchMoreOnBottomReached = useCallback(() => {
    if (inView && !isFetchingNextPage && hasNextPage) {
      fetchNextPage();
    }
  }, [fetchNextPage, inView, isFetchingNextPage, hasNextPage]);

  useEffect(() => {
    fetchMoreOnBottomReached();
  }, [fetchMoreOnBottomReached]);

  return (
    <Stack
      gap={1}
      bg="blackAlpha.300"
      px={4}
      py={3}
      borderRadius="md"
      maxHeight={350}
      border="2px"
      borderColor="gray.600"
      overflow="auto"
      divider={<Divider />}
    >
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
      {(status === "loading" || isFetchingNextPage) && (
        <Center>
          <Spinner margin={4} />
        </Center>
      )}
      {error && <InlineErrorAlert title="Failed to list feeds" description={error.message} />}
      <div ref={scrollRef} />
    </Stack>
  );
};
