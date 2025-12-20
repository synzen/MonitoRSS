import { Badge, Box, Button, Flex, HStack, Icon, Stack, Text } from "@chakra-ui/react";
import { WarningIcon } from "@chakra-ui/icons";
import { Link } from "react-router-dom";
import { pages } from "../../../../../constants";
import { UserFeedTabSearchParam } from "../../../../../constants/userFeedTabSearchParam";
import { getHttpStatusMessage, getGenericErrorMessage } from "./deliveryPreviewUtils";

export interface FeedState {
  state: string;
  errorType?: string;
  httpStatusCode?: number;
}

interface FeedLevelStateDisplayProps {
  feedState: FeedState;
  feedId: string;
}

interface HttpStatusErrorDisplayProps {
  statusCode: number;
  feedId: string;
}

const HttpStatusErrorDisplay = ({ statusCode, feedId }: HttpStatusErrorDisplayProps) => {
  const statusInfo = getHttpStatusMessage(statusCode);
  const StatusIcon = statusInfo.icon;

  return (
    <Box
      role="status"
      py={6}
      px={4}
      borderLeftWidth="4px"
      borderLeftColor={`${statusInfo.colorScheme}.400`}
      bg={
        statusInfo.severity === "auth" || statusInfo.severity === "not-found"
          ? `${statusInfo.colorScheme}.900`
          : undefined
      }
    >
      <Flex
        direction={{ base: "column", sm: "row" }}
        justifyContent={{ base: "flex-start", sm: "space-between" }}
        alignItems={{ base: "flex-start", sm: "center" }}
        gap={2}
        mb={3}
      >
        <HStack spacing={2}>
          <Icon as={StatusIcon} color={`${statusInfo.colorScheme}.400`} aria-hidden="true" />
          <Text fontWeight="semibold" color="white">
            {statusInfo.title}
          </Text>
        </HStack>
        <Badge
          colorScheme={statusInfo.colorScheme}
          variant={statusInfo.badgeVariant}
          fontSize="xs"
          fontFamily="mono"
        >
          HTTP {statusCode}
        </Badge>
      </Flex>
      <Stack spacing={2}>
        <Text color="whiteAlpha.900">{statusInfo.explanation}</Text>
        <Text fontSize="sm" color="whiteAlpha.800">
          {statusInfo.action}
        </Text>
      </Stack>
      <Button
        as={Link}
        to={pages.userFeed(feedId, { tab: UserFeedTabSearchParam.Logs })}
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

interface GenericErrorDisplayProps {
  feedState: string;
  errorType?: string;
  feedId: string;
}

const GenericErrorDisplay = ({ feedState, errorType, feedId }: GenericErrorDisplayProps) => {
  const errorInfo = getGenericErrorMessage(feedState, errorType);

  return (
    <Box role="status" py={6} px={4} borderLeftWidth="4px" borderLeftColor="red.400">
      <HStack spacing={2} mb={3}>
        <Icon as={WarningIcon} color="red.400" aria-hidden="true" />
        <Text fontWeight="semibold" color="white">
          {errorInfo.title}
        </Text>
      </HStack>
      <Text color="whiteAlpha.900">{errorInfo.explanation}</Text>
      <Button
        as={Link}
        to={pages.userFeed(feedId, { tab: UserFeedTabSearchParam.Logs })}
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

export const FeedLevelStateDisplay = ({ feedState, feedId }: FeedLevelStateDisplayProps) => {
  // Note: "unchanged" state is no longer a feed-level state.
  // When the feed is unchanged, the backend returns articles with FeedUnchanged outcome.

  if (
    feedState.state === "fetch-error" &&
    feedState.errorType === "bad-status-code" &&
    feedState.httpStatusCode
  ) {
    return <HttpStatusErrorDisplay statusCode={feedState.httpStatusCode} feedId={feedId} />;
  }

  if (feedState.state === "fetch-error" || feedState.state === "parse-error") {
    return (
      <GenericErrorDisplay
        feedState={feedState.state}
        errorType={feedState.errorType}
        feedId={feedId}
      />
    );
  }

  return null;
};
