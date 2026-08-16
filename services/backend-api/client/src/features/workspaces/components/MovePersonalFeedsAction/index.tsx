import { Alert, Button, Flex, Link, Skeleton, Stack, Text } from "@chakra-ui/react";
import { Fragment, useCallback, useEffect, useState } from "react";
import { ConfirmModal, InlineErrorAlert } from "@/components";
import { OwnedPersonalFeedPicker, useOwnedPersonalFeeds } from "@/features/feed";
import { DiscordUsername } from "@/features/discordUser";
import { pages } from "@/constants";
import { useMovePersonalFeedsToWorkspace } from "../../hooks";
import type { WorkspaceRole } from "../../types";

interface SharingInfo {
  sharedSelectedCount: number;
  affectedUserIds: string[];
  anyConnectionScoped: boolean;
}

interface Props {
  workspaceName: string;
  workspaceSlug: string;
  allowance: number;
  workspaceHasActiveRedditGrant: boolean;
  workspaceRole?: WorkspaceRole | null;
  presentation?: "banner" | "toolbar";
  onMoved: (movedCount: number) => void;
}

export const MovePersonalFeedsAction = ({
  workspaceName,
  workspaceSlug,
  allowance,
  workspaceHasActiveRedditGrant,
  workspaceRole,
  presentation = "banner",
  onMoved,
}: Props) => {
  const { data, status, error } = useOwnedPersonalFeeds({
    limit: 1,
    sort: "createdAt",
  });
  const total = data?.pages[0]?.total;
  const [open, setOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sharing, setSharing] = useState<SharingInfo | null>(null);
  const [redditSelectedCount, setRedditSelectedCount] = useState(0);
  const moveMutation = useMovePersonalFeedsToWorkspace();
  const onSharingChange = useCallback((info: SharingInfo) => setSharing(info), []);
  const onRedditChange = useCallback(
    (info: { redditSelectedCount: number }) => setRedditSelectedCount(info.redditSelectedCount),
    [],
  );

  useEffect(() => {
    if (!open) {
      setSelectedIds(new Set());
      setSharing(null);
      setRedditSelectedCount(0);
    }
  }, [open]);

  const breakingRedditCount = workspaceHasActiveRedditGrant ? 0 : redditSelectedCount;

  const onConfirm = async () => {
    const result = await moveMutation.mutateAsync({
      workspaceSlug,
      feedIds: [...selectedIds],
    });
    onMoved(result.result.movedCount);
    setOpen(false);
  };

  if (status === "loading") {
    return (
      <Flex
        role="status"
        aria-live="polite"
        alignItems="center"
        gap={3}
        minHeight="8"
        bg="bg.subtle"
        borderWidth="1px"
        borderColor="border"
        borderRadius="l3"
        px={{ base: 4, md: 5 }}
        py={4}
      >
        <Text color="fg.muted" fontSize="sm">
          Checking for personal feeds you can move…
        </Text>
        <Skeleton height="4" width="24" />
      </Flex>
    );
  }

  if (error) {
    return (
      <InlineErrorAlert title="Could not check your personal feeds" description={error.message} />
    );
  }

  if (!total && !open) {
    return null;
  }

  const capacityFull = allowance <= 0;
  const trigger =
    presentation === "toolbar" ? (
      <Flex alignItems="center" gap={2} flexWrap="wrap">
        <Button variant="outline" size="sm" disabled={capacityFull} onClick={() => setOpen(true)}>
          Move personal feeds
        </Button>
        {capacityFull && (
          <Text color="fg.muted" fontSize="sm">
            Workspace is full.{" "}
            {workspaceRole === "owner" ? (
              <Link href={pages.workspaceBilling(workspaceSlug)} color="text.link">
                Manage capacity
              </Link>
            ) : (
              "Contact the owner to add capacity."
            )}
          </Text>
        )}
      </Flex>
    ) : (
      <Flex
        alignItems={{ base: "flex-start", sm: "center" }}
        flexDirection={{ base: "column", sm: "row" }}
        justifyContent="space-between"
        gap={{ base: 3, sm: 5 }}
        bg="bg.subtle"
        borderWidth="1px"
        borderColor="border"
        borderRadius="l3"
        px={{ base: 4, md: 5 }}
        py={4}
      >
        <Text color="fg.muted" fontSize="sm">
          <Text as="span" color="fg" fontWeight="semibold">
            Already have personal feeds?
          </Text>{" "}
          Keep their existing delivery setup when you move them here.
        </Text>
        <Button
          variant="outline"
          size="sm"
          flexShrink={0}
          disabled={capacityFull}
          onClick={() => setOpen(true)}
        >
          Move personal feeds
        </Button>
      </Flex>
    );

  return (
    <>
      {trigger}
      <ConfirmModal
        open={open}
        onOpenChange={setOpen}
        title={`Move personal feeds to ${workspaceName}`}
        okText="Move feeds"
        role="dialog"
        showCloseButton
        okDisabled={selectedIds.size === 0 || selectedIds.size > allowance}
        error={moveMutation.error?.message}
        onConfirm={onConfirm}
        descriptionNode={
          <Stack gap={4}>
            <Text>
              These feeds become owned by {workspaceName}. Everyone on the team can manage them, and
              they stay with {workspaceName} if you leave.
            </Text>
            <Text color="fg.muted" fontSize="sm">
              Your personal subscription and this team&apos;s subscription do not change.
            </Text>
            {(sharing?.sharedSelectedCount ?? 0) > 0 && (
              <Alert.Root status="warning">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Title>
                    {sharing?.sharedSelectedCount === 1
                      ? "1 selected feed is shared"
                      : `${sharing?.sharedSelectedCount} selected feeds are shared`}
                  </Alert.Title>
                  <Alert.Description>
                    Personal sharing will be removed. Affected co-managers:{" "}
                    {sharing?.affectedUserIds.map((id, index) => (
                      <Fragment key={id}>
                        {index > 0 ? ", " : ""}
                        <DiscordUsername userId={id} />
                      </Fragment>
                    ))}
                    . They will lose access and will not be notified. Invite them to the team if
                    they should keep managing these feeds.
                  </Alert.Description>
                </Alert.Content>
              </Alert.Root>
            )}
            {breakingRedditCount > 0 && (
              <Alert.Root status="warning">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Title>Reddit connection needed</Alert.Title>
                  <Alert.Description>
                    {breakingRedditCount === 1 ? "This feed" : "These feeds"} may move in a paused
                    or needs-attention state until this team has an active Reddit connection.
                  </Alert.Description>
                  <Link
                    href={pages.workspaceSettings(workspaceSlug)}
                    target="_blank"
                    rel="noopener noreferrer"
                    color="text.link"
                    aria-label={`Connect Reddit for ${workspaceName}`}
                  >
                    Connect Reddit for this team
                  </Link>
                </Alert.Content>
              </Alert.Root>
            )}
            <OwnedPersonalFeedPicker
              selectedIds={selectedIds}
              onSelectedIdsChange={setSelectedIds}
              allowance={allowance}
              copy={{
                sharedSelected:
                  "Shared. Its co-managers lose access when this feed moves to the team.",
                sharedConnectionScopedSelected:
                  "Shared. A co-manager has access to only some connections; moving this feed gives them access to the whole feed as a team member.",
                redditSelected:
                  "Reddit feed. It may need attention until this team has an active Reddit connection.",
              }}
              onSharingChange={onSharingChange}
              onRedditChange={onRedditChange}
              retainSelectedRows={!!moveMutation.error}
            />
          </Stack>
        }
      />
    </>
  );
};
