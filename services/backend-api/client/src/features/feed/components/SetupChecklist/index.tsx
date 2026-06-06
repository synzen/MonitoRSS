import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box, Button, HStack, Stack, Text, VisuallyHidden } from "@chakra-ui/react";
import { FaCircleCheck, FaChevronDown, FaChevronUp } from "react-icons/fa6";
import { PrimaryActionButton } from "@/components/PrimaryActionButton";
import { AddConnectionDialog } from "../../../feedConnections/AddConnectionDialog";
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
  const [isExpanded, setIsExpanded] = useState(true);
  const cardListId = "setup-checklist-feeds";
  const doneButtonRef = useRef<HTMLButtonElement>(null);
  const sectionRef = useRef<HTMLDivElement>(null);
  const feedCountAtDialogClose = useRef<number | null>(null);

  const isComplete = feeds.length === 0;
  const [announcement, setAnnouncement] = useState("");
  const shouldAnnounce = useRef(false);

  const announceStatus = useCallback(() => {
    if (!shouldAnnounce.current) return;
    shouldAnnounce.current = false;

    if (feeds.length === 0) {
      setAnnouncement("All feeds are delivering");
    } else {
      setAnnouncement(feeds.length === 1 ? "1 feed remaining" : `${feeds.length} feeds remaining`);
    }
  }, [feeds.length]);

  useEffect(() => {
    announceStatus();
  }, [announceStatus]);

  const sortedFeeds = useMemo(
    () =>
      [...feeds].sort((a, b) => {
        if (a.connectionCount === 0 && b.connectionCount > 0) return -1;
        if (a.connectionCount > 0 && b.connectionCount === 0) return 1;

        return 0;
      }),
    [feeds],
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

  const handleAddConnection = (feedId: string) => {
    setActiveConnectionFeedId(feedId);
  };

  const handleDialogClose = () => {
    feedCountAtDialogClose.current = feeds.length;
    shouldAnnounce.current = true;
    setActiveConnectionFeedId(undefined);
    onConnectionCreated();
  };

  return (
    <>
      <Box
        ref={sectionRef}
        role="region"
        aria-label="Feed delivery setup"
        bg="bg.panel"
        borderWidth="1px"
        borderColor="border"
        borderLeftWidth="4px"
        borderLeftColor="brandSolid"
        borderRadius="l3"
        p={4}
        mt={2}
      >
        {isComplete ? (
          <HStack justifyContent="space-between" flexWrap="wrap" gap={2}>
            <HStack gap={2}>
              <FaCircleCheck color="text.success" aria-hidden="true" />
              <Text>All feeds are delivering</Text>
            </HStack>
            <PrimaryActionButton ref={doneButtonRef} size="sm" onClick={onDismiss}>
              Done
            </PrimaryActionButton>
          </HStack>
        ) : (
          <>
            <Button
              variant="plain"
              display="flex"
              alignItems="center"
              width="100%"
              height="auto"
              textAlign="left"
              fontWeight="normal"
              whiteSpace="normal"
              onClick={() => setIsExpanded((prev) => !prev)}
              aria-expanded={isExpanded}
              aria-controls={cardListId}
            >
              <HStack gap={2} flex={1}>
                <Box flex={1}>
                  <Text fontWeight="semibold">
                    {feeds.length} feed{feeds.length !== 1 ? "s" : ""} need
                    {feeds.length === 1 ? "s" : ""} delivery connections
                  </Text>
                  <Text color="fg.muted" fontSize="sm">
                    Choose where each feed&apos;s articles are delivered.
                  </Text>
                </Box>
                <Box flexShrink={0} aria-hidden="true">
                  {isExpanded ? <FaChevronUp /> : <FaChevronDown />}
                </Box>
              </HStack>
            </Button>
            {isExpanded && (
              <>
                <Stack
                  id={cardListId}
                  gap={3}
                  mt={4}
                  mb={2}
                  aria-label="Feeds needing delivery setup"
                  role="region"
                >
                  {sortedFeeds.map((feed) => (
                    <SetupChecklistCard
                      key={feed.id}
                      feed={feed}
                      onAddConnection={handleAddConnection}
                    />
                  ))}
                </Stack>
                <Text color="fg.muted" fontSize="sm" aria-hidden="true">
                  {remainingLabel}
                </Text>
              </>
            )}
          </>
        )}
        <VisuallyHidden role="status" aria-live="polite" aria-atomic="true">
          {announcement}
        </VisuallyHidden>
      </Box>
      <AddConnectionDialog
        feedId={activeConnectionFeedId}
        isOpen={!!activeConnectionFeedId}
        onClose={handleDialogClose}
        finalFocusRef={sectionRef}
      />
    </>
  );
};
