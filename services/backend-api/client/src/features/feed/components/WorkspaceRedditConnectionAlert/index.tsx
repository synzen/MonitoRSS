import { Alert, Box, HStack, Link, Stack, Text } from "@chakra-ui/react";
import { FaUpRightFromSquare } from "react-icons/fa6";
import { useUserFeedContext } from "../../contexts/UserFeedContext";
import { useFeedScope } from "../../contexts/FeedScopeContext";
import { isRedditFeedUrl } from "../../utils/isRedditFeedUrl";
import { RedditLoginButton } from "../../../discordUser";
import { pages } from "../../../../constants";

// Safety net for a Reddit feed that moved into a workspace with no Reddit grant.
// Such a feed resolves the WORKSPACE's connection (never the owner's personal
// one), so without a workspace grant it silently stops fetching with no failure
// record to trip UserFeedHealthAlert. This proactively flags that state and
// offers the remedy in place. Only fires in workspace scope; in personal scope
// the feed uses the owner's personal connection, handled elsewhere.
export const WorkspaceRedditConnectionAlert = () => {
  const { userFeed } = useUserFeedContext();
  const { workspaceId, workspaceSlug, redditConnection, refreshRedditConnection } = useFeedScope();

  const isWorkspaceScope = !!workspaceSlug;
  const isReddit = isRedditFeedUrl(userFeed.url);
  const hasActiveGrant = redditConnection?.status === "ACTIVE";

  if (!isWorkspaceScope || !isReddit || hasActiveGrant) {
    return null;
  }

  return (
    <Stack>
      <Alert.Root status="warning">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>This feed needs a workspace Reddit connection</Alert.Title>
          <Alert.Description display="block">
            <Stack gap={4}>
              <Text>
                Reddit feeds in a workspace fetch using the workspace&apos;s own Reddit connection,
                not anyone&apos;s personal one. This workspace has no active Reddit connection, so
                this feed is not fetching new articles. Connect Reddit to this workspace to resume
                updates.
              </Text>
              <HStack flexWrap="wrap" gap={3}>
                <RedditLoginButton
                  size="md"
                  emphasis="primary"
                  onConnected={() => refreshRedditConnection?.()}
                  workspace={
                    workspaceId
                      ? {
                          id: workspaceId,
                          connectionStatus: redditConnection?.status ?? null,
                          refresh: () => refreshRedditConnection?.(),
                        }
                      : undefined
                  }
                />
                {workspaceSlug ? (
                  <Box>
                    <Link
                      href={pages.workspaceSettings(workspaceSlug)}
                      color="text.link"
                      fontSize="sm"
                      display="inline-flex"
                      alignItems="center"
                      gap={1}
                      aria-label="Connect Reddit to this workspace in settings"
                    >
                      Workspace Reddit settings
                      <FaUpRightFromSquare aria-hidden />
                    </Link>
                  </Box>
                ) : null}
              </HStack>
            </Stack>
          </Alert.Description>
        </Alert.Content>
      </Alert.Root>
    </Stack>
  );
};
