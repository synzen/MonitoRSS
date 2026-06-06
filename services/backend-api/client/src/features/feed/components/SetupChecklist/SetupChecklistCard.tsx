import { useState } from "react";
import { Box, HStack, Stack, Text, Button } from "@chakra-ui/react";
import { FaPlus, FaCheck, FaTriangleExclamation } from "react-icons/fa6";
import { getAvatarColor } from "@/utils/getAvatarColor";
import { Panel } from "@/components/Panel";

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
    <HStack gap={1}>
      {isConfigured ? (
        <FaCheck color="var(--chakra-colors-green-300)" size={12} aria-hidden="true" />
      ) : (
        <FaTriangleExclamation
          color="var(--chakra-colors-orange-300)"
          size={12}
          aria-hidden="true"
        />
      )}
      <Text color={isConfigured ? "text.success" : "text.warning"} fontSize="sm">
        {connectionText}
      </Text>
    </HStack>
  );

  const connectionButton = (width?: string) => (
    <Button
      size="sm"
      colorPalette={isConfigured ? undefined : "brand"}
      variant={isConfigured ? "ghost" : "solid"}
      width={width}
      aria-label={buttonLabel}
      onClick={() => onAddConnection(feed.id)}
    >
      <FaPlus />
      {isConfigured ? "Add another" : "Add connection"}
    </Button>
  );

  return (
    <Panel as="article" data-feed-card tabIndex={-1} p={3} aria-label={feed.title}>
      <Stack gap={3}>
        <HStack gap={3}>
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
                <Text color="fg" fontSize="sm" fontWeight="bold" lineHeight="1" aria-hidden="true">
                  {feed.title.charAt(0).toUpperCase()}
                </Text>
              </Box>
            ) : (
              <Box
                w="32px"
                h="32px"
                borderRadius="l3"
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
            <Text fontWeight="bold" lineClamp={1} title={feed.title}>
              {feed.title}
            </Text>
            <Text color="fg.muted" fontSize="xs" lineClamp={1}>
              {domain}
            </Text>
          </Box>
          <HStack gap={3} flexShrink={0} display={{ base: "none", md: "flex" }}>
            {statusIndicator}
            {connectionButton()}
          </HStack>
        </HStack>
        <Box display={{ base: "block", md: "none" }}>
          <Box mb={3}>{statusIndicator}</Box>
          {connectionButton("full")}
        </Box>
      </Stack>
    </Panel>
  );
};
