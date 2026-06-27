import { Alert, Box, Stack, Text } from "@chakra-ui/react";
import { RedditLoginButton, useUserMe } from "../../../discordUser";
import { useFeedScope } from "../../contexts/FeedScopeContext";
import { isRedditFeedUrl } from "../../utils/isRedditFeedUrl";

type Variant = "rate-limited" | "required";

interface Props {
  url: string;
  variant?: Variant;
  onCorrected?: () => void;
}

export const FixFeedRequestsCTA = ({ url, variant = "rate-limited", onCorrected }: Props) => {
  const { data } = useUserMe();
  const { workspaceId, redditConnection, refreshRedditConnection } = useFeedScope();
  const isReddit = isRedditFeedUrl(url);
  const isWorkspaceScope = !!workspaceId;

  if (!isReddit) {
    return null;
  }

  // In workspace scope the gate resolves against the WORKSPACE's connection — a member's
  // personal connection never powers workspace feeds (and vice versa).
  const personalAccount = data?.result.externalAccounts?.find((e) => e.type === "reddit");
  const hasRedditConnected = isWorkspaceScope
    ? redditConnection?.status === "ACTIVE"
    : personalAccount?.status === "ACTIVE";

  // For the rate-limited variant, an active connection means there's nothing to
  // prompt for - the request failed for another reason.
  if (variant === "rate-limited" && hasRedditConnected) {
    return null;
  }

  // The mandatory gate only fires server-side when the account is not active, so
  // an active connection here means the gate is stale; nothing to prompt.
  if (variant === "required" && hasRedditConnected) {
    return null;
  }

  // A reddit connection record exists but is no longer active (revoked/expired).
  const needsReconnect = isWorkspaceScope
    ? !!redditConnection && !hasRedditConnected
    : !!personalAccount && !hasRedditConnected;

  const title =
    variant === "required"
      ? `Connect ${isWorkspaceScope ? "a" : "your"} Reddit account to continue`
      : `Connect ${isWorkspaceScope ? "a" : "your"} Reddit account`;

  const accountNoun = isWorkspaceScope ? "a Reddit account for this workspace" : "your account";

  const description =
    variant === "required"
      ? `Reddit heavily rate-limits unauthenticated requests, so Reddit feeds need a connected account to fetch reliably. Connect ${accountNoun} to add this feed.`
      : `Reddit heavily rate-limits unauthenticated requests. Connecting ${accountNoun} gives Reddit feeds the higher quota they need to fetch reliably.`;

  const reconnectDescription = isWorkspaceScope
    ? "This workspace's Reddit connection is no longer active. Any member can reconnect with their own Reddit account to add this feed."
    : "Your Reddit connection is no longer active. Reconnect your account to add this feed.";

  return (
    <Stack>
      <Alert.Root status={variant === "required" ? "info" : "success"}>
        <Alert.Content>
          <Alert.Title>
            {needsReconnect
              ? `Reconnect ${isWorkspaceScope ? "this workspace's" : "your"} Reddit account`
              : title}
          </Alert.Title>
          <Alert.Description>
            <Stack gap={4}>
              <Text>{needsReconnect ? reconnectDescription : description}</Text>
              <Stack>
                <Box>
                  <RedditLoginButton
                    size="md"
                    emphasis={variant === "required" ? "primary" : undefined}
                    colorPalette={variant === "required" ? undefined : "green"}
                    onConnected={onCorrected}
                    workspace={
                      isWorkspaceScope
                        ? {
                            id: workspaceId,
                            connectionStatus: redditConnection?.status ?? null,
                            refresh: () => refreshRedditConnection?.(),
                          }
                        : undefined
                    }
                  />
                </Box>
                <Text color="fg.muted" fontSize="sm">
                  A window will pop up prompting for authorization.
                </Text>
              </Stack>
            </Stack>
          </Alert.Description>
        </Alert.Content>
      </Alert.Root>
    </Stack>
  );
};
