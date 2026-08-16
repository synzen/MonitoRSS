import { Heading, Stack, Text } from "@chakra-ui/react";
import { ReactNode } from "react";

interface Props {
  workspaceName: string;
  moveAction: ReactNode;
  search: ReactNode;
  popularFeeds: ReactNode;
}

export const WorkspaceFeedDiscoveryEmptyState = ({
  workspaceName,
  moveAction,
  search,
  popularFeeds,
}: Props) => (
  <Stack gap={{ base: 8, md: 10 }} pb={10}>
    <Stack maxW="760px" gap={3} role="status" aria-live="polite">
      <Heading as="h2" fontSize={{ base: "3xl", md: "4xl" }} lineHeight="1.1">
        Add feeds to {workspaceName}
      </Heading>
      <Text color="fg.muted" fontSize={{ base: "md", md: "lg" }} maxW="680px">
        Search for a source, paste a feed URL, or browse popular feeds. Feeds added here are shared
        with workspace members.
      </Text>
    </Stack>
    {moveAction}
    <Stack gap={{ base: 7, md: 9 }}>
      <Stack gap={3} w="full">
        <Text fontWeight="semibold">Find a feed</Text>
        {search}
      </Stack>
      {popularFeeds}
    </Stack>
  </Stack>
);
