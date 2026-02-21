import { Button, Center, Heading, Stack, Text } from "@chakra-ui/react";
import { SearchIcon } from "@chakra-ui/icons";

interface FilteredEmptyStateProps {
  onClearAllFilters: () => void;
}

export const FilteredEmptyState: React.FC<FilteredEmptyStateProps> = ({ onClearAllFilters }) => {
  return (
    <Center py={16}>
      <Stack alignItems="center" spacing={4}>
        <SearchIcon boxSize={12} color="whiteAlpha.400" />
        <Stack alignItems="center" spacing={2}>
          <Heading as="h3" size="md">
            No matching feeds
          </Heading>
          <Text color="whiteAlpha.600">
            No feeds match your current filters. Try adjusting or clearing them.
          </Text>
        </Stack>
        <Button variant="outline" onClick={onClearAllFilters}>
          Clear all filters
        </Button>
      </Stack>
    </Center>
  );
};
