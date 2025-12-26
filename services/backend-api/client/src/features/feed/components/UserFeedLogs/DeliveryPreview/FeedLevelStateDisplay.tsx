import { Badge, Box, Button, Flex, HStack, Icon, Stack, Text } from "@chakra-ui/react";
import {
  FeedErrorInfo,
  getHttpStatusMessage,
  getGenericErrorMessage,
} from "./deliveryPreviewUtils";

const scrollToRequestHistory = () => {
  document.getElementById("request-history")?.scrollIntoView({ behavior: "smooth" });
};

export interface FeedState {
  state: string;
  errorType?: string;
  httpStatusCode?: number;
}

interface FeedLevelStateDisplayProps {
  feedState: FeedState;
}

interface FeedErrorDisplayProps {
  errorInfo: FeedErrorInfo;
}

const FeedErrorDisplay = ({ errorInfo }: FeedErrorDisplayProps) => {
  const StatusIcon = errorInfo.icon;

  return (
    <Box
      role="status"
      py={6}
      px={4}
      borderLeftWidth="4px"
      borderLeftColor={`${errorInfo.colorScheme}.400`}
      bg={errorInfo.severity === "blocking" ? `${errorInfo.colorScheme}.900` : undefined}
    >
      <Flex
        direction={{ base: "column", sm: "row" }}
        justifyContent={{ base: "flex-start", sm: "space-between" }}
        alignItems={{ base: "flex-start", sm: "center" }}
        gap={2}
        mb={3}
      >
        <HStack spacing={2}>
          <Icon as={StatusIcon} color={`${errorInfo.colorScheme}.400`} aria-hidden="true" />
          <Text fontWeight="semibold" color="white">
            {errorInfo.title}
          </Text>
        </HStack>
        <Badge
          colorScheme={errorInfo.colorScheme}
          variant={errorInfo.badgeVariant}
          fontSize="xs"
          fontFamily="mono"
        >
          {errorInfo.badgeText}
        </Badge>
      </Flex>
      <Stack spacing={2}>
        <Text color="whiteAlpha.900">{errorInfo.explanation}</Text>
        <Text fontSize="sm" color="whiteAlpha.800">
          {errorInfo.action}
        </Text>
      </Stack>
      <Button
        onClick={scrollToRequestHistory}
        size={{ base: "md", md: "sm" }}
        width={{ base: "100%", md: "auto" }}
        variant="outline"
        mt={4}
        minH="44px"
      >
        View Request History
      </Button>
    </Box>
  );
};

export const FeedLevelStateDisplay = ({ feedState }: FeedLevelStateDisplayProps) => {
  // Note: "unchanged" state is no longer a feed-level state.
  // When the feed is unchanged, the backend returns articles with FeedUnchanged outcome.

  if (
    feedState.state === "fetch-error" &&
    feedState.errorType === "bad-status-code" &&
    feedState.httpStatusCode
  ) {
    const errorInfo = getHttpStatusMessage(feedState.httpStatusCode);

    return <FeedErrorDisplay errorInfo={errorInfo} />;
  }

  if (feedState.state === "fetch-error" || feedState.state === "parse-error") {
    const errorInfo = getGenericErrorMessage(feedState.state, feedState.errorType);

    return <FeedErrorDisplay errorInfo={errorInfo} />;
  }

  return null;
};
