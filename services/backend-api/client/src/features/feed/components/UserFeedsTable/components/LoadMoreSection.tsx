import { Center, Stack, Text } from "@chakra-ui/react";
import { SafeLoadingButton } from "@/components/SafeLoadingButton";

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
  const isDisabled = !hasNextPage || totalCount === loadedCount;

  return (
    <Stack>
      <Center>
        <Text color="fg.muted" fontSize="sm">
          Viewed {loadedCount} of {totalCount} feeds
        </Text>
      </Center>
      <SafeLoadingButton
        disabled={isDisabled}
        loading={isFetchingNextPage}
        onClick={onLoadMore}
        mb={20}
      >
        <span>Load More</span>
      </SafeLoadingButton>
    </Stack>
  );
};
