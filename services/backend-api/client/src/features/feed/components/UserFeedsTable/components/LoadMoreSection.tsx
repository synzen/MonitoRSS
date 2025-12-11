import { Button, Center, Stack, Text } from "@chakra-ui/react";

interface LoadMoreSectionProps {
  loadedCount: number;
  totalCount: number;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
}

export const LoadMoreSection: React.FC<LoadMoreSectionProps> = ({
  loadedCount,
  totalCount,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
}) => {
  const isDisabled = !hasNextPage || isFetchingNextPage || totalCount === loadedCount;

  return (
    <Stack>
      <Center>
        <Text color="whiteAlpha.600" fontSize="sm">
          Viewed {loadedCount} of {totalCount} feeds
        </Text>
      </Center>
      <Button isDisabled={isDisabled} isLoading={isFetchingNextPage} onClick={onLoadMore} mb={20}>
        <span>Load More</span>
      </Button>
    </Stack>
  );
};
