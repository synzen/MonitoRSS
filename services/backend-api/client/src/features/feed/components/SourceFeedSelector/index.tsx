import React, { useCallback, useRef } from "react";
import { chakra, Box, Button, Flex, HStack, Text, useDisclosure } from "@chakra-ui/react";
import { FaArrowsRotate, FaTrash } from "react-icons/fa6";
import { SelectFeedModal } from "../SelectFeedModal";
import { useSourceFeed, useSetSourceFeedWithData } from "../../contexts/SourceFeedContext";

export const SourceFeedSelector: React.FC = () => {
  const { sourceFeed } = useSourceFeed();
  const setSourceFeedWithData = useSetSourceFeedWithData();
  const { open, onOpen, onClose } = useDisclosure();
  const changeSourceFeedButton = useRef<HTMLButtonElement>(null);
  const selectSourceFeedButton = useRef<HTMLButtonElement>(null);

  const handleFeedSelected = (feedId: string, title: string, url: string) => {
    setSourceFeedWithData({
      id: feedId,
      title,
      url,
    });

    onClose();
  };

  const handleRemoveFeed = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      selectSourceFeedButton.current?.focus();
      setSourceFeedWithData(null);
    },
    [selectSourceFeedButton.current, setSourceFeedWithData],
  );

  return (
    <>
      <Box
        hidden={!!sourceFeed}
        p={3}
        bg="bg.subtle"
        borderRadius="l3"
        borderLeft="4px solid"
        borderLeftColor="border"
      >
        <Text fontWeight="semibold" fontSize="md" mb={2}>
          No Source Feed Selected
        </Text>
        <Flex direction="column" gap={3}>
          <Box>
            <Text fontSize="sm" color="fg.muted">
              No source feed selected. Setting a source feed will copy its settings to new feeds.
            </Text>
          </Box>
          <Button
            size="sm"
            onClick={onOpen}
            variant="solid"
            alignSelf="flex-start"
            aria-label="Select source feed to copy all settings from"
            ref={selectSourceFeedButton}
          >
            <FaArrowsRotate aria-hidden="true" /> Select source feed
          </Button>
        </Flex>
      </Box>
      <Box
        hidden={!sourceFeed}
        p={3}
        bg="bg.subtle"
        borderRadius="l3"
        borderLeft="4px solid"
        borderLeftColor="brandSolid"
      >
        <Text fontWeight="semibold" fontSize="md" mb={2}>
          Selected Source Feed
        </Text>
        <Flex direction="column" gap={3}>
          <Box>
            <chakra.span srOnly id="source-feed-title">
              Title:
            </chakra.span>
            <Text fontWeight="medium" lineClamp={1} aria-labelledby="source-feed-title">
              {sourceFeed?.title || "Loading..."}
            </Text>
            <chakra.span srOnly id="source-feed-url">
              URL:
            </chakra.span>
            {sourceFeed?.url && (
              <Text fontSize="sm" color="fg.muted" lineClamp={1} aria-labelledby="source-feed-url">
                {sourceFeed.url}
              </Text>
            )}
          </Box>
          <HStack gap={3} pt={1}>
            <Button
              size="sm"
              onClick={onOpen}
              colorPalette="brand"
              variant="outline"
              ref={changeSourceFeedButton}
              aria-label="Change source feed"
            >
              <FaArrowsRotate aria-hidden="true" /> Change
            </Button>
            <Button
              size="sm"
              onClick={handleRemoveFeed}
              variant="ghost"
              colorPalette="red"
              aria-label="Remove source feed"
            >
              <FaTrash aria-hidden="true" /> Remove
            </Button>
          </HStack>
        </Flex>
      </Box>
      <SelectFeedModal
        isOpen={open}
        onClose={onClose}
        onFeedSelected={handleFeedSelected}
        finalFocusRef={changeSourceFeedButton}
      />
    </>
  );
};
