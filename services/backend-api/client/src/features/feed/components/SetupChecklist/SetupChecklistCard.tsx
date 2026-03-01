import { useState } from "react";
import { Box, HStack, Stack, Text, Button } from "@chakra-ui/react";
import { AddIcon, CheckIcon, WarningIcon } from "@chakra-ui/icons";
import { getAvatarColor } from "@/utils/getAvatarColor";

interface SetupChecklistCardProps {
  feed: {
    id: string;
    title: string;
    url: string;
    connectionCount: number;
  };
  onAddConnection: (feedId: string) => void;
}

export const SetupChecklistCard = ({ feed, onAddConnection }: SetupChecklistCardProps) => {
  const [imgError, setImgError] = useState(false);

  let domain: string;

  try {
    domain = new URL(feed.url).hostname;
  } catch {
    domain = feed.url;
  }

  const isConfigured = feed.connectionCount > 0;

  const connectionText = isConfigured
    ? `${feed.connectionCount} connection${feed.connectionCount === 1 ? "" : "s"} configured`
    : "No connection \u2014 not delivering";

  const buttonLabel = isConfigured
    ? `Add another connection to ${feed.title}`
    : `Add connection to ${feed.title}`;

  const statusIndicator = (
    <HStack spacing={1}>
      {isConfigured ? (
        <CheckIcon color="green.300" boxSize={3} aria-hidden="true" />
      ) : (
        <WarningIcon color="orange.300" boxSize={3} aria-hidden="true" />
      )}
      <Text color={isConfigured ? "green.300" : "orange.300"} fontSize="sm">
        {connectionText}
      </Text>
    </HStack>
  );

  const connectionButton = (width?: string) => (
    <Button
      size="sm"
      colorScheme={isConfigured ? undefined : "blue"}
      variant={isConfigured ? "ghost" : "solid"}
      width={width}
      aria-label={buttonLabel}
      leftIcon={<AddIcon fontSize="xs" />}
      onClick={() => onAddConnection(feed.id)}
    >
      {isConfigured ? "Add another" : "Add connection"}
    </Button>
  );

  return (
    <Box
      as="article"
      data-feed-card
      tabIndex={-1}
      bg="gray.800"
      borderWidth="1px"
      borderColor="gray.600"
      borderRadius="md"
      p={3}
      aria-label={feed.title}
    >
      <Stack spacing={3}>
        <HStack spacing={3}>
          <Box flexShrink={0}>
            {imgError ? (
              <Box
                w="32px"
                h="32px"
                borderRadius="full"
                bg={getAvatarColor(feed.title)}
                display="flex"
                alignItems="center"
                justifyContent="center"
              >
                <Text
                  color="white"
                  fontSize="sm"
                  fontWeight="bold"
                  lineHeight="1"
                  aria-hidden="true"
                >
                  {feed.title.charAt(0).toUpperCase()}
                </Text>
              </Box>
            ) : (
              <Box
                w="32px"
                h="32px"
                borderRadius="md"
                bg="white"
                display="flex"
                alignItems="center"
                justifyContent="center"
                flexShrink={0}
              >
                <img
                  src={`https://www.google.com/s2/favicons?sz=32&domain=${domain}`}
                  alt=""
                  width={28}
                  height={28}
                  onError={() => setImgError(true)}
                />
              </Box>
            )}
          </Box>

          <Box flex={1} minW={0}>
            <Text fontWeight="bold" noOfLines={1} title={feed.title}>
              {feed.title}
            </Text>
            <Text color="gray.400" fontSize="xs" noOfLines={1}>
              {domain}
            </Text>
          </Box>

          <HStack spacing={3} flexShrink={0} display={{ base: "none", md: "flex" }}>
            {statusIndicator}
            {connectionButton()}
          </HStack>
        </HStack>

        <Box display={{ base: "block", md: "none" }}>
          <Box mb={3}>{statusIndicator}</Box>
          {connectionButton("full")}
        </Box>
      </Stack>
    </Box>
  );
};
