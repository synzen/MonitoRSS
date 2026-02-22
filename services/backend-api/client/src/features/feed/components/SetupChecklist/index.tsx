import { useEffect, useMemo, useRef, useState } from "react";
import { Box, Button, Heading, HStack, Stack, Text, VisuallyHidden } from "@chakra-ui/react";
import { CheckCircleIcon } from "@chakra-ui/icons";
import { AddConnectionDialog } from "../../../feedConnections/components/AddConnectionDialog";
import type { ConnectionType } from "../../../feedConnections/constants";
import { SetupChecklistCard } from "./SetupChecklistCard";

interface SetupChecklistProps {
  feeds: Array<{
    id: string;
    title: string;
    url: string;
    connectionCount: number;
  }>;
  onConnectionCreated: () => void;
  onDismiss: () => void;
}

export const SetupChecklist = ({ feeds, onConnectionCreated, onDismiss }: SetupChecklistProps) => {
  const [activeConnectionFeedId, setActiveConnectionFeedId] = useState<string | undefined>();
  const [addConnectionType, setAddConnectionType] = useState<
    { type: ConnectionType } | undefined
  >();
  const doneButtonRef = useRef<HTMLButtonElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const feedCountAtDialogClose = useRef<number | null>(null);

  const isComplete = feeds.length === 0;

  const sortedFeeds = useMemo(
    () =>
      [...feeds].sort((a, b) => {
        if (a.connectionCount === 0 && b.connectionCount > 0) return -1;
        if (a.connectionCount > 0 && b.connectionCount === 0) return 1;
        return 0;
      }),
    [feeds]
  );

  const remainingLabel =
    feeds.length === 1 ? "1 feed remaining" : `${feeds.length} feeds remaining`;

  useEffect(() => {
    if (feedCountAtDialogClose.current === null) return;
    if (feeds.length === feedCountAtDialogClose.current) return;
    feedCountAtDialogClose.current = null;

    if (isComplete) {
      doneButtonRef.current?.focus();
    } else {
      const firstCard = sectionRef.current?.querySelector<HTMLElement>("[data-feed-card]");
      firstCard?.focus();
    }
  }, [feeds.length, isComplete]);

  const handleAddConnection = (feedId: string, type: ConnectionType) => {
    setActiveConnectionFeedId(feedId);
    setAddConnectionType({ type });
  };

  const handleDialogClose = () => {
    feedCountAtDialogClose.current = feeds.length;
    setActiveConnectionFeedId(undefined);
    setAddConnectionType(undefined);
    onConnectionCreated();
  };

  return (
    <Box
      ref={sectionRef}
      as="section"
      tabIndex={-1}
      aria-label="Feed delivery setup"
      bg="gray.800"
      borderWidth="1px"
      borderColor="gray.600"
      borderRadius="md"
      p={5}
    >
      <Heading as="h2" size="md" mb={isComplete ? 4 : 1}>
        Set up delivery
      </Heading>

      <VisuallyHidden role="status" aria-live="polite" aria-atomic="true">
        {isComplete ? "All feeds are delivering" : remainingLabel}
      </VisuallyHidden>

      {isComplete ? (
        <HStack justifyContent="space-between">
          <HStack spacing={2}>
            <CheckCircleIcon color="green.300" aria-hidden="true" />
            <Text>All feeds are delivering</Text>
          </HStack>
          <Button ref={doneButtonRef} size="sm" colorScheme="blue" onClick={onDismiss}>
            Done
          </Button>
        </HStack>
      ) : (
        <>
          <Text color="gray.400" mb={4}>
            Choose where each feed&apos;s articles are delivered.
          </Text>

          <Stack spacing={3} mb={4}>
            {sortedFeeds.map((feed) => (
              <SetupChecklistCard key={feed.id} feed={feed} onAddConnection={handleAddConnection} />
            ))}
          </Stack>

          <Text color="gray.400" fontSize="sm" aria-hidden="true">
            {remainingLabel}
          </Text>
        </>
      )}

      <AddConnectionDialog
        feedId={activeConnectionFeedId}
        type={addConnectionType?.type}
        isOpen={!!activeConnectionFeedId}
        onClose={handleDialogClose}
        finalFocusRef={sectionRef}
      />
    </Box>
  );
};
