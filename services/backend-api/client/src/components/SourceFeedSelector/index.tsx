import React, { useCallback, useRef } from "react";
import { chakra, Box, Button, Flex, HStack, Text, useDisclosure } from "@chakra-ui/react";
import { RepeatIcon, DeleteIcon } from "@chakra-ui/icons";
import { SelectFeedModal } from "../SelectFeedModal";
import { useSourceFeed, useSetSourceFeedWithData } from "../../contexts/SourceFeedContext";

export const SourceFeedSelector: React.FC = () => {
  const { sourceFeed } = useSourceFeed();
  const setSourceFeedWithData = useSetSourceFeedWithData();
  const { isOpen, onOpen, onClose } = useDisclosure();
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
    [selectSourceFeedButton.current, setSourceFeedWithData]
  );

  return (
    <>
      <Box
        hidden={!!sourceFeed}
        p={3}
        bg="whiteAlpha.50"
        borderRadius="md"
        borderLeft="4px solid"
        borderLeftColor="gray.500"
      >
        <Text fontWeight="semibold" fontSize="md" mb={2}>
          No Source Feed Selected
        </Text>
        <Flex direction="column" gap={3}>
          <Box>
            <Text fontSize="sm" color="whiteAlpha.700">
              No source feed selected. Setting a source feed will copy its settings to new feeds.
            </Text>
          </Box>
          <Button
            size="sm"
            leftIcon={<RepeatIcon />}
            onClick={onOpen}
            variant="solid"
            alignSelf="flex-start"
            aria-label="Select source feed to copy all settings from"
            ref={selectSourceFeedButton}
          >
            Select source feed
          </Button>
        </Flex>
      </Box>
      <Box
        hidden={!sourceFeed}
        p={3}
        bg="whiteAlpha.100"
        borderRadius="md"
        borderLeft="4px solid"
        borderLeftColor="blue.400"
      >
        <Text fontWeight="semibold" fontSize="md" mb={2}>
          Selected Source Feed
        </Text>
        <Flex direction="column" gap={3}>
          <Box>
            <chakra.span srOnly id="source-feed-title">
              Title:
            </chakra.span>
            <Text fontWeight="medium" noOfLines={1} aria-labelledby="source-feed-title">
              {sourceFeed?.title || "Loading..."}
            </Text>
            <chakra.span srOnly id="source-feed-url">
              URL:
            </chakra.span>
            {sourceFeed?.url && (
              <Text
                fontSize="sm"
                color="whiteAlpha.700"
                noOfLines={1}
                aria-labelledby="source-feed-url"
              >
                {sourceFeed.url}
              </Text>
            )}
          </Box>
          <HStack spacing={3} pt={1}>
            <Button
              size="sm"
              leftIcon={<RepeatIcon />}
              onClick={onOpen}
              colorScheme="blue"
              variant="outline"
              ref={changeSourceFeedButton}
              aria-label="Change source feed"
            >
              Change
            </Button>
            <Button
              size="sm"
              leftIcon={<DeleteIcon />}
              onClick={handleRemoveFeed}
              variant="ghost"
              colorScheme="red"
              aria-label="Remove source feed"
            >
              Remove
            </Button>
          </HStack>
        </Flex>
      </Box>
      <SelectFeedModal
        isOpen={isOpen}
        onClose={onClose}
        onFeedSelected={handleFeedSelected}
        finalFocusRef={changeSourceFeedButton}
      />
    </>
  );
};
