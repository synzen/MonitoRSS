import { Button, Center, Icon, Separator, Stack, Heading, Text } from "@chakra-ui/react";
import { FaMagnifyingGlass } from "react-icons/fa6";
import { parseSearchInputAsUrl } from "../../../utils/normalizeUrlInput";

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
  const isUrl = !!trimmedSearch && parseSearchInputAsUrl(trimmedSearch).isUrl;

  return (
    <Center py={16}>
      <Stack alignItems="center" gap={4}>
        <Icon as={FaMagnifyingGlass} boxSize={12} color="fg.subtle" />
        <Stack alignItems="center" gap={2}>
          <Heading as="h3" size="md">
            No matching feeds
          </Heading>
          <Text color="fg.muted">
            No feeds match your current filters. Try adjusting or clearing them.
          </Text>
        </Stack>
        <Button variant="outline" onClick={onClearAllFilters}>
          Clear all filters
        </Button>
        {trimmedSearch && onSearchForNewFeed && (
          <>
            <Separator borderColor="border" />
            <Stack alignItems="center" gap={1}>
              <Text fontSize="sm" color="fg.muted">
                {isUrl ? "This looks like a feed URL." : "Can’t find what you’re looking for?"}
              </Text>
              <Button
                variant="plain"
                textDecoration="underline"
                colorPalette="brand"
                size="sm"
                onClick={() => onSearchForNewFeed(trimmedSearch)}
              >
                {isUrl ? "Add it as a new feed →" : "Search for new feeds to add →"}
              </Button>
            </Stack>
          </>
        )}
      </Stack>
    </Center>
  );
};
