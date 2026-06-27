import { Badge, HStack, Stack, Text } from "@chakra-ui/react";
import { SafeLoadingButton } from "@/components/SafeLoadingButton";
import { InlineErrorAlert } from "@/components/InlineErrorAlert";
import { DiscordUsername, RedditLoginButton, useUserMe } from "@/features/discordUser";
import { useWorkspace } from "../../hooks/useWorkspace";
import { useDisconnectWorkspaceReddit } from "../../hooks/useDisconnectWorkspaceReddit";

interface Props {
  workspaceSlug: string;
}

/**
 * The workspace's Reddit connection: one member's personal Reddit grant backs every
 * Reddit feed in the workspace. Shows who connected it ("Connected by X") and lets ANY
 * member connect, replace, or disconnect it — when the connection breaks, the widest
 * possible set of people can fix it with their own account.
 */
export const WorkspaceRedditConnectionSetting = ({ workspaceSlug }: Props) => {
  const { workspace, refetch } = useWorkspace({ workspaceSlug });
  const { data: userMe } = useUserMe();
  const {
    mutateAsync: disconnect,
    status: disconnectStatus,
    error: disconnectError,
  } = useDisconnectWorkspaceReddit();

  if (!workspace) {
    return null;
  }

  const connection = workspace.redditConnection;
  const isActive = connection?.status === "ACTIVE";
  const isRevoked = !!connection && !isActive;
  const connectedBySelf = !!connection && connection.connectedBy.userId === userMe?.result.id;

  return (
    <Stack gap={2}>
      <HStack
        justifyContent="space-between"
        borderStyle="solid"
        alignItems="flex-start"
        borderWidth={1}
        borderColor="border"
        rounded="l3"
        p={4}
        gap={4}
        flexWrap="wrap"
      >
        <Stack flex="1" minW="260px">
          <Stack gap={1}>
            <HStack alignItems="center" gap={2}>
              <Text fontWeight={600}>Reddit</Text>
              {isActive && <Badge colorPalette="green">Connected</Badge>}
              {isRevoked && <Badge colorPalette="red">Disconnected</Badge>}
              {!connection && <Badge>Not Connected</Badge>}
            </HStack>
            {connection && (
              <Text color="fg.muted" fontSize="sm">
                Connected by{" "}
                {connection.connectedBy.discordUserId ? (
                  <DiscordUsername userId={connection.connectedBy.discordUserId} />
                ) : (
                  "a former member"
                )}
                {connectedBySelf ? " (you)" : ""}
              </Text>
            )}
            <Text color="fg.muted" fontSize="sm">
              {isRevoked
                ? "This workspace's Reddit connection is no longer active. Any member can reconnect with their own Reddit account so the workspace's Reddit feeds keep updating."
                : "Reddit feeds in this workspace fetch using this connection's rate limit quotas, which are much higher than the global limits. One member connects their Reddit account on behalf of the whole workspace, and any member can replace or remove it."}
            </Text>
          </Stack>
        </Stack>
        <HStack flexShrink={0}>
          <RedditLoginButton
            workspace={{
              id: workspace.id,
              connectionStatus: (connection?.status as "ACTIVE" | "REVOKED") ?? null,
              refresh: refetch,
            }}
          />
          {connection && (
            <SafeLoadingButton
              colorPalette="red"
              variant="ghost"
              size="sm"
              loading={disconnectStatus === "loading"}
              onClick={() => {
                disconnect({ workspaceSlug }).catch(() => {
                  // Surfaced via disconnectError below
                });
              }}
            >
              <span>Disconnect</span>
            </SafeLoadingButton>
          )}
        </HStack>
      </HStack>
      {disconnectError && (
        <InlineErrorAlert
          title="Failed to disconnect Reddit"
          description={disconnectError.message}
        />
      )}
    </Stack>
  );
};
