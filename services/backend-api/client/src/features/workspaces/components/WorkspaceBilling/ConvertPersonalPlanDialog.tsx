import { useEffect, useState } from "react";
import { Box, Stack, Text, chakra } from "@chakra-ui/react";
import { ConfirmModal } from "@/components/ConfirmModal";
import { useConvertWorkspaceBilling } from "../../hooks";
import { ConvertPersonalPlanFeedList } from "./ConvertPersonalPlanFeedList";

// The feed-move dialog for activating a workspace by moving a personal plan
// onto it. The common case (more slots than feeds) is a one-click "bring
// everything"; the feed list is tucked behind a disclosure. Only when the owner
// has more feeds than the plan's limit does the list open up front, pre-seeded
// with the feeds that fit, so the dialog opens in a valid state. Unselected
// feeds stay on the now-free personal account and are disabled there.
export const ConvertPersonalPlanDialog = ({
  open,
  onClose,
  onConverted,
  workspaceSlug,
  feedLimit,
}: {
  open: boolean;
  onClose: () => void;
  onConverted: () => void;
  workspaceSlug: string;
  feedLimit: number;
}) => {
  const convertMutation = useConvertWorkspaceBilling();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loadInfo, setLoadInfo] = useState<{ total: number; overLimit: boolean } | null>(null);

  // Reset the per-open selection state whenever the dialog closes, so reopening
  // re-seeds from scratch rather than reusing a stale selection.
  useEffect(() => {
    if (!open) {
      setSelectedIds(new Set());
      setLoadInfo(null);
    }
  }, [open]);

  const selectedCount = selectedIds.size;
  const overCapacity = selectedCount > feedLimit;
  const overLimit = loadInfo?.overLimit ?? false;
  // Nothing selected = nothing to move. Only reachable in the over-limit case
  // (under the limit the list defaults to everything selected).
  const nothingSelected = loadInfo !== null && selectedCount === 0;

  const onConfirm = async () => {
    await convertMutation.mutateAsync({
      workspaceSlug,
      feedIds: [...selectedIds],
    });
    onConverted();
    onClose();
  };

  const feedList = (
    <ConvertPersonalPlanFeedList
      selectedIds={selectedIds}
      onSelectedIdsChange={setSelectedIds}
      feedLimit={feedLimit}
      onLoaded={setLoadInfo}
    />
  );

  return (
    <ConfirmModal
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title="Move your personal plan to this team"
      okText="Move plan"
      showCloseButton
      // Over the limit this is a triage surface (pick 70 of 100+), so it widens
      // to give feed titles room and the list space to scan. Under the limit it
      // stays the default size: a calm confirmation with the feeds tucked behind
      // a disclosure.
      size={overLimit ? "xl" : undefined}
      confirmationPhrase={workspaceSlug}
      okDisabled={overCapacity || nothingSelected}
      error={
        convertMutation.error?.message ??
        (overCapacity
          ? `Your plan fits ${feedLimit} feeds. Unselect ${selectedCount - feedLimit} to continue.`
          : undefined)
      }
      onConfirm={onConfirm}
      descriptionNode={
        <Stack gap={4}>
          <Text>
            Your personal plan becomes the plan for this team, and the feeds you choose move with
            it. You will no longer have a personal plan. This is not easily reversible.
          </Text>
          {/* Over the limit the feed list shows its own always-visible capacity
              meter, so a second counter here would be redundant. Under the limit
              the list is tucked behind a disclosure (no meter on screen), so this
              stays the capacity indicator. */}
          {!overLimit && (
            <Text fontWeight="medium" aria-live="polite">
              {`${selectedCount} of ${feedLimit} feeds selected`}
            </Text>
          )}
          {overLimit ? (
            <>
              <Text fontSize="sm" color="text.warning">
                You have more feeds than this plan allows, so choose which ones to bring. Any feed
                you do not pick stays on your personal plan, which drops to the free plan and
                disables feeds over its limit.
              </Text>
              {feedList}
            </>
          ) : (
            <chakra.details>
              <chakra.summary
                cursor="pointer"
                fontSize="sm"
                color="text.link"
                _marker={{ color: "fg.muted" }}
              >
                Choose which feeds to bring
              </chakra.summary>
              <Box mt={3}>{feedList}</Box>
            </chakra.details>
          )}
        </Stack>
      }
    />
  );
};
