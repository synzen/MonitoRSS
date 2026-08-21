import { useCallback, useEffect, useRef, useState } from "react";
import { Box, Collapsible, HStack, Stack, Text, chakra } from "@chakra-ui/react";
import { FaChevronRight } from "react-icons/fa6";
import { ConfirmModal } from "@/components/ConfirmModal";
import { OwnedPersonalFeedPicker, type OwnedPersonalFeedPickerCopy } from "@/features/feed";
import { useConvertWorkspaceBilling } from "../../hooks";
import {
  PersonalFeedMoveWarnings,
  type PersonalFeedSharingInfo,
} from "../PersonalFeedMoveWarnings";

const planConversionPickerCopy: Partial<OwnedPersonalFeedPickerCopy> = {
  legend: "Feeds to bring to this workspace",
  capacityFull: "Plan full",
  autoPickDirectionLabel: "Which feeds to bring when you have more than the plan allows",
  autoPickLead: "Bring my",
  pickedResult: (direction, selected, remaining) =>
    `Selected your ${direction} ${selected} feeds, shown first below.${
      remaining > 0 ? ` ${remaining} stay on your personal plan.` : ""
    }`,
  unselectedPlain: "Stays personal",
  sharedSelected: "Shared. Its co-managers lose access when this feed moves to the workspace.",
  sharedUnselected: "Shared. Staying on your personal plan, so its sharing is kept.",
  redditUnselected: "Reddit feed. Staying on your personal plan, so its connection is kept.",
  sharedUnselectedBadge: "Shared. Staying personal, sharing kept",
  redditUnselectedBadge: "Reddit. Staying personal, connection kept",
};

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
  workspaceHasActiveRedditGrant,
}: {
  open: boolean;
  onClose: () => void;
  onConverted: () => void;
  workspaceSlug: string;
  feedLimit: number;
  // Whether the TARGET workspace already has an active Reddit connection. A
  // moved Reddit feed resolves the workspace's connection, never the owner's
  // personal one, so without a workspace grant it pauses after the move. When
  // the grant is present there is nothing to warn about.
  workspaceHasActiveRedditGrant: boolean;
}) => {
  const convertMutation = useConvertWorkspaceBilling();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loadInfo, setLoadInfo] = useState<{
    total: number;
    overLimit: boolean;
  } | null>(null);
  const [sharing, setSharing] = useState<PersonalFeedSharingInfo | null>(null);
  const [redditSelectedCount, setRedditSelectedCount] = useState(0);
  // The under-limit feed list is a disclosure. Controlled so it can auto-open
  // when a sharing warning appears (revealing the per-row remedy) while the owner
  // can still collapse/expand it themselves.
  const [listOpen, setListOpen] = useState(false);
  // Initial focus target: an empty, text-free, role-less sentinel at the TOP of
  // the content. This is deliberately NOT the title heading: the dialog re-renders
  // several times right after open (the feed list query resolves, sharing/reddit/
  // liveReady state settles), and the modal focus-trap re-asserts focus on its
  // initial target across those re-renders. Re-focusing a heading re-announces it
  // (the bug that produced "title, title, title"); re-focusing an empty sentinel
  // announces nothing. The dialog's name + description are still announced once on
  // open via aria-labelledby / aria-describedby, independent of where focus lands,
  // so the sentinel costs no context. Forward-Tab from here reaches the feed
  // controls (whereas the default Cancel sits at the END of the DOM, forcing a
  // keyboard user to traverse the whole body backwards).
  const topAnchorRef = useRef<HTMLDivElement>(null);

  // Stable so the feed list's effect that calls it does not re-run on every
  // render (it lists onSharingChange as a dependency).
  const onSharingChange = useCallback((info: PersonalFeedSharingInfo) => setSharing(info), []);
  const onRedditChange = useCallback(
    (info: { redditSelectedCount: number }) => setRedditSelectedCount(info.redditSelectedCount),
    [],
  );

  // Reset the per-open selection state whenever the dialog closes, so reopening
  // re-seeds from scratch rather than reusing a stale selection.
  useEffect(() => {
    if (!open) {
      setSelectedIds(new Set());
      setLoadInfo(null);
      setSharing(null);
      setRedditSelectedCount(0);
      setListOpen(false);
    }
  }, [open]);

  // Auto-open the list once a shared feed is in the selection, so the warning's
  // remedy (unselect a shared feed to keep it personal) is visible without an
  // extra click. Does not force it back open afterward — the owner stays in
  // control once it is revealed.
  const hasSharedSelected = (sharing?.sharedSelectedCount ?? 0) > 0;

  // Only warn about Reddit when a moved feed actually loses its connection: a
  // Reddit feed is selected AND the workspace has no grant of its own. With a
  // grant the moved feed just uses it, so there is nothing to warn about.
  const breakingRedditCount = workspaceHasActiveRedditGrant ? 0 : redditSelectedCount;
  const hasBreakingReddit = breakingRedditCount > 0;

  useEffect(() => {
    if (hasSharedSelected || hasBreakingReddit) {
      setListOpen(true);
    }
  }, [hasSharedSelected, hasBreakingReddit]);

  // The live regions exist for the DYNAMIC case: a warning that appears or
  // changes AFTER the dialog is open should be spoken without moving focus. On
  // initial open the warnings are static content the dialog already reads
  // top-to-bottom (the visible alerts), so announcing them via a live region too
  // would double-read. `liveReady` gates the regions to stay empty until the
  // user's first selection change after open, so the open read is the visible
  // alerts alone and later toggles are the live region alone — one source per
  // moment. Reset on close so the next open starts silent again.
  const [liveReady, setLiveReady] = useState(false);

  useEffect(() => {
    if (!open) {
      setLiveReady(false);
    }
  }, [open]);

  const markLiveReady = useCallback(() => setLiveReady(true), []);

  const selectedCount = selectedIds.size;
  const overCapacity = selectedCount > feedLimit;
  const overLimit = loadInfo?.overLimit ?? false;
  // Nothing selected while the owner HAS feeds = nothing to move; block. But an
  // account with no personal feeds is still convertible (move the plan, bring
  // nothing), so a zero selection is only invalid when there were feeds to pick.
  const nothingSelected = loadInfo !== null && loadInfo.total > 0 && selectedCount === 0;

  const onConfirm = async () => {
    await convertMutation.mutateAsync({
      workspaceSlug,
      feedIds: [...selectedIds],
    });
    onConverted();
    onClose();
  };

  const feedList = (
    <OwnedPersonalFeedPicker
      selectedIds={selectedIds}
      onSelectedIdsChange={setSelectedIds}
      allowance={feedLimit}
      copy={planConversionPickerCopy}
      onLoaded={setLoadInfo}
      onSharingChange={onSharingChange}
      onRedditChange={onRedditChange}
      // The first user-driven selection edit (toggle / auto-pick / clear, not the
      // initial seed) is when the warnings stop being static open-read content
      // and become live updates, so this is the moment the live regions are
      // allowed to start speaking.
      onUserEdit={markLiveReady}
    />
  );

  return (
    <ConfirmModal
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title="Move your personal plan to this workspace"
      okText="Move plan"
      showCloseButton
      // This is a task surface (a feed list to triage + a required phrase), not a
      // brief yes/no, so it is a plain dialog, not an alertdialog: alertdialog
      // promises a short alert message and biases AT toward reading it, which is
      // wrong here. Initial focus goes to an empty top-of-content sentinel (see
      // topAnchorRef) rather than Cancel at the end of the DOM, which would force a
      // keyboard user to traverse the whole feed list backwards to reach it.
      role="dialog"
      initialFocusEl={() => topAnchorRef.current}
      // Over the limit this is a triage surface (pick 70 of 100+), so it widens
      // fully to give feed titles room and the list space to scan. Under the
      // limit it stays a calm confirmation with the feeds behind a disclosure,
      // but still steps up a size: two warnings plus the list and phrase input
      // crowd the default width, so "lg" gives them breathing room without the
      // oversized feel of the triage layout.
      size={overLimit ? "xl" : "lg"}
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
          {/* Top-of-content focus sentinel (see topAnchorRef / initialFocusEl).
              tabIndex={-1} makes it programmatically focusable without adding a tab
              stop; no text and no role, so focusing (or the focus-trap re-focusing)
              it announces nothing. It MUST have a non-zero box: the focus-trap only
              accepts a visible element (offsetWidth/Height > 0) as its initial
              focus and otherwise silently falls back to Cancel, so a zero-size
              sentinel would not hold focus. The 1px height is absorbed by the
              negative bottom margin so the Stack spacing is visually unchanged. */}
          <Box ref={topAnchorRef} tabIndex={-1} outline="none" h="1px" w="full" mb="-1px" />
          {/* Plain text, intentionally NOT Dialog.Description. Making it the
              aria-describedby target caused NVDA to read it twice: once as the
              announced dialog description on open, and again as the first body
              content when the reading cursor entered the dialog. A bare Text (the
              same shape the simple ConfirmModal confirmations use) is read exactly
              once, as content. The dialog name is still announced via
              aria-labelledby; focus lands on the sentinel above, not on this text,
              so it is never read as the focused element either. */}
          <Text>
            Your personal plan becomes the plan for this workspace, and the feeds you choose move
            with it. You will no longer have a personal plan. This is not easily reversible.
          </Text>
          {/* Over the limit the feed list shows its own always-visible capacity
              meter, so a second counter here would be redundant. Under the limit
              the list is tucked behind a disclosure (no meter on screen), so this
              stays the capacity indicator. It is static content read once on open;
              the aria-live is gated by liveReady so it announces only when the
              count CHANGES after a user edit, never a second time on open. */}
          {!overLimit && (
            <Text fontWeight="medium" aria-live={liveReady ? "polite" : "off"}>
              {`${selectedCount} of ${feedLimit} feeds selected`}
            </Text>
          )}
          <PersonalFeedMoveWarnings
            sharing={sharing}
            breakingRedditCount={breakingRedditCount}
            workspaceSlug={workspaceSlug}
            liveReady={liveReady}
          />
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
            // Controlled disclosure: auto-opens when a shared feed is selected so
            // the warning's remedy is visible (the per-row chips show which feeds
            // are shared, and unselecting one keeps it personal), while the owner
            // can still toggle it. Chakra's Collapsible (not native <details>):
            // its trigger is a real button with aria-expanded and NO native
            // ::marker triangle, so a screen reader does not announce a stray
            // marker glyph. The chevron is an explicit aria-hidden icon.
            <Collapsible.Root open={listOpen} onOpenChange={(e) => setListOpen(e.open)}>
              <Collapsible.Trigger asChild>
                <chakra.button
                  type="button"
                  cursor="pointer"
                  fontSize="sm"
                  color="text.link"
                  _hover={{ textDecoration: "underline" }}
                >
                  <HStack gap={1}>
                    <chakra.span
                      aria-hidden
                      display="inline-flex"
                      transition="transform 0.15s"
                      transform={listOpen ? "rotate(90deg)" : undefined}
                      mr={1}
                    >
                      <FaChevronRight />
                    </chakra.span>
                    <span>Choose which feeds to bring</span>
                  </HStack>
                </chakra.button>
              </Collapsible.Trigger>
              <Collapsible.Content>
                <Box mt={3}>{feedList}</Box>
              </Collapsible.Content>
            </Collapsible.Root>
          )}
        </Stack>
      }
    />
  );
};
