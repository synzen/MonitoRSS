import { Button, Center, Divider, Heading, Stack, Text } from "@chakra-ui/react";
import { SearchIcon } from "@chakra-ui/icons";

const URL_PATTERN = /^https?:\/\//;

interface FilteredEmptyStateProps {
  onClearAllFilters: () => void;
  searchTerm?: string;
  onSearchForNewFeed?: (term: string) => void;
}

export const FilteredEmptyState: React.FC<FilteredEmptyStateProps> = ({
  onClearAllFilters,
  searchTerm,
  onSearchForNewFeed,
}) => {
  const trimmedSearch = searchTerm?.trim();
  const isUrl = trimmedSearch && URL_PATTERN.test(trimmedSearch);

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
        {trimmedSearch && onSearchForNewFeed && (
          <>
            <Divider borderColor="whiteAlpha.300" />
            <Stack alignItems="center" spacing={1}>
              <Text fontSize="sm" color="whiteAlpha.700">
                {isUrl
                  ? "This looks like a feed URL."
                  : "Can\u2019t find what you\u2019re looking for?"}
              </Text>
              <Button
                variant="link"
                colorScheme="blue"
                size="sm"
                onClick={() => onSearchForNewFeed(trimmedSearch)}
              >
                {isUrl ? "Add it as a new feed \u2192" : "Search for new feeds to add \u2192"}
              </Button>
            </Stack>
          </>
        )}
      </Stack>
    </Center>
  );
};
