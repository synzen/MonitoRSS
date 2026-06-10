import { Button, Card, Badge, Box, HStack, Stack, Text } from "@chakra-ui/react";
import { FaChevronRight } from "react-icons/fa6";
import { Link as RouterLink } from "react-router-dom";
import { UserFeed, useFeedScope } from "@/features/feed";
import {
  FeedConnectionDisabledCode,
  FeedConnectionType,
  FeedDiscordChannelConnection,
} from "@/types";
import { pages } from "@/constants";
import { DiscordChannelConnectionSettings } from "./DiscordChannelConnectionSettings";
import { getPrettyConnectionName } from "../../utils/getPrettyConnectionName";
import { getPrettyConnectionDetail } from "../../utils/getPrettyConnectionDetail";

interface Props {
  feedId: string;
  connection: UserFeed["connections"][number];
}

const DISABLED_CODES_FOR_ERROR = [
  FeedConnectionDisabledCode.MissingMedium,
  FeedConnectionDisabledCode.MissingPermissions,
  FeedConnectionDisabledCode.BadFormat,
];

export const ConnectionCard = ({ feedId, connection }: Props) => {
  const { workspaceSlug } = useFeedScope();
  const isError = DISABLED_CODES_FOR_ERROR.includes(
    connection.disabledCode as FeedConnectionDisabledCode,
  );

  let cardLeftBorder = "";

  if (isError) {
    cardLeftBorder = "solid 3px var(--app-text-error)";
  } else if (connection.disabledCode === FeedConnectionDisabledCode.Manual) {
    cardLeftBorder = "solid 3px var(--app-fg-muted)";
  }

  const connectionDetail = getPrettyConnectionDetail(connection as never);

  return (
    <Card.Root
      key={connection.id}
      variant="elevated"
      size="sm"
      borderLeft={cardLeftBorder}
      rounded="lg"
      paddingX={1}
      asChild
    >
      <article>
        <Card.Header>
          <HStack justifyContent="space-between" alignItems="flex-start">
            <Stack gap="1">
              <Box>
                <Text color="fg.muted" fontSize="sm">
                  {getPrettyConnectionName(connection as never)}
                </Text>
                {connectionDetail ? <Box> {connectionDetail}</Box> : null}
              </Box>
              <HStack>
                <Text fontWeight={600} as="h3" id={connection.id}>
                  {connection.name}
                </Text>
                {connection.disabledCode === FeedConnectionDisabledCode.Manual && (
                  <Badge fontSize="x-small">Disabled</Badge>
                )}
                {isError && (
                  <Badge fontSize="x-small" colorPalette="red">
                    Error
                  </Badge>
                )}
              </HStack>
            </Stack>
            {connection.key === FeedConnectionType.DiscordChannel && (
              <DiscordChannelConnectionSettings
                connection={connection as FeedDiscordChannelConnection}
                feedId={feedId}
              />
            )}
          </HStack>
        </Card.Header>
        <Card.Footer justifyContent="space-between">
          <Box />
          <Button
            asChild
            aria-labelledby={`manage-${connection.id} ${connection.id}`}
            id={`manage-${connection.id}`}
          >
            <RouterLink
              to={pages.userFeedConnection({
                feedId: feedId as string,
                connectionType: connection.key,
                connectionId: connection.id,
                scope: workspaceSlug ? { workspaceSlug } : undefined,
              })}
            >
              Manage
              <FaChevronRight />
            </RouterLink>
          </Button>
        </Card.Footer>
      </article>
    </Card.Root>
  );
};
