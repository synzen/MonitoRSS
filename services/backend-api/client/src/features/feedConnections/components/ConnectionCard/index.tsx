import {
  Button,
  Card,
  CardFooter,
  CardHeader,
  Badge,
  Box,
  HStack,
  Stack,
  Text,
} from "@chakra-ui/react";
import { ChevronRightIcon } from "@chakra-ui/icons";
import { Link as RouterLink } from "react-router-dom";
import { UserFeed } from "../../../feed/types";
import {
  FeedConnectionDisabledCode,
  FeedConnectionType,
  FeedDiscordChannelConnection,
} from "../../../../types";
import getChakraColor from "../../../../utils/getChakraColor";
import { pages } from "../../../../constants";
import { DiscordChannelConnectionSettings } from "./DiscordChannelConnectionSettings";
import { getPrettyConnectionName } from "../../../../utils/getPrettyConnectionName";
import { getPrettyConnectionDetail } from "../../../../utils/getPrettyConnectionDetail";

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
  const isError = DISABLED_CODES_FOR_ERROR.includes(
    connection.disabledCode as FeedConnectionDisabledCode
  );

  let cardLeftBorder = "";

  if (isError) {
    cardLeftBorder = `solid 3px ${getChakraColor("red.400")}`;
  } else if (connection.disabledCode === FeedConnectionDisabledCode.Manual) {
    cardLeftBorder = `solid 3px ${getChakraColor("gray.400")}`;
  }

  const connectionDetail = getPrettyConnectionDetail(connection as never);

  return (
    <Card
      key={connection.id}
      variant="elevated"
      size="sm"
      borderLeft={cardLeftBorder}
      rounded="lg"
      paddingX={1}
      as="article"
    >
      <CardHeader>
        <HStack justifyContent="space-between" alignItems="flex-start">
          <Stack spacing="1">
            <Box>
              <Text color="gray.400" fontSize="sm">
                {getPrettyConnectionName(connection as never)}
              </Text>
              {connectionDetail ? <Box> {connectionDetail}</Box> : null}
            </Box>
            <HStack>
              <Text fontWeight={600} as="h3" id={connection.id}>
                {connection.name}
              </Text>
              {connection.disabledCode === FeedConnectionDisabledCode.Manual && (
                <Badge fontSize="x-small" colorScheme="gray">
                  Disabled
                </Badge>
              )}
              {isError && (
                <Badge fontSize="x-small" colorScheme="red">
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
      </CardHeader>
      <CardFooter justifyContent="space-between">
        <Box />
        <Button
          as={RouterLink}
          to={pages.userFeedConnection({
            feedId: feedId as string,
            connectionType: connection.key,
            connectionId: connection.id,
          })}
          rightIcon={<ChevronRightIcon />}
          aria-labelledby={`manage-${connection.id} ${connection.id}`}
          id={`manage-${connection.id}`}
        >
          Manage
        </Button>
      </CardFooter>
    </Card>
  );
};
