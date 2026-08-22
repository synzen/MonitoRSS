import { Button, Flex, Skeleton, Stack, Text } from "@chakra-ui/react";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FaArrowRightArrowLeft, FaGaugeHigh } from "react-icons/fa6";
import { ConfirmModal, InlineErrorAlert } from "@/components";
import { MenuItem, MenuSeparator } from "@/components/ui/menu";
import { OwnedPersonalFeedPicker, useOwnedPersonalFeeds } from "@/features/feed";
import { pages } from "@/constants";
import { useMovePersonalFeedsToWorkspace } from "../../hooks";
import type { WorkspaceRole } from "../../types";
import {
  PersonalFeedMoveWarnings,
  type PersonalFeedSharingInfo,
} from "../PersonalFeedMoveWarnings";

interface Props {
  workspaceName: string;
  workspaceSlug: string;
  allowance: number;
  workspaceHasActiveRedditGrant: boolean;
  workspaceRole?: WorkspaceRole | null;
  presentation?: "banner" | "menu";
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
  const [sharing, setSharing] = useState<PersonalFeedSharingInfo | null>(null);
  const [redditSelectedCount, setRedditSelectedCount] = useState(0);
  const [liveReady, setLiveReady] = useState(false);
  const moveMutation = useMovePersonalFeedsToWorkspace();
  const onSharingChange = useCallback((info: PersonalFeedSharingInfo) => setSharing(info), []);
  const onRedditChange = useCallback(
    (info: { redditSelectedCount: number }) => setRedditSelectedCount(info.redditSelectedCount),
    [],
  );

  useEffect(() => {
    if (!open) {
      setSelectedIds(new Set());
      setSharing(null);
      setRedditSelectedCount(0);
      setLiveReady(false);
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
    if (presentation === "menu") {
      return (
        <>
          <MenuSeparator />
          <MenuItem value="move-personal-feeds-loading" disabled>
            <FaArrowRightArrowLeft />
            Checking personal feeds…
          </MenuItem>
        </>
      );
    }

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
    if (presentation === "menu") {
      return (
        <>
          <MenuSeparator />
          <MenuItem value="move-personal-feeds-error" disabled>
            <FaArrowRightArrowLeft />
            Could not check personal feeds
          </MenuItem>
        </>
      );
    }

    return (
      <InlineErrorAlert title="Could not check your personal feeds" description={error.message} />
    );
  }

  if (!total && !open) {
    return null;
  }

  const capacityFull = allowance <= 0;
  const trigger =
    presentation === "menu" ? (
      <>
        <MenuSeparator />
        <MenuItem value="move-personal-feeds" disabled={capacityFull} onClick={() => setOpen(true)}>
          <FaArrowRightArrowLeft />
          {capacityFull
            ? `Move personal feeds — ${
                workspaceRole === "owner" ? "workspace full" : "contact the owner for capacity"
              }`
            : "Move personal feeds"}
        </MenuItem>
        {capacityFull && workspaceRole === "owner" && (
          <MenuItem value="manage-feed-capacity" asChild>
            <Link to={pages.workspaceBilling(workspaceSlug)}>
              <FaGaugeHigh />
              Manage feed capacity
            </Link>
          </MenuItem>
        )}
      </>
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
            <PersonalFeedMoveWarnings
              sharing={sharing}
              breakingRedditCount={breakingRedditCount}
              workspaceSlug={workspaceSlug}
              liveReady={liveReady}
            />
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
              onUserEdit={() => setLiveReady(true)}
              retainSelectedRows={!!moveMutation.error}
            />
          </Stack>
        }
      />
    </>
  );
};
