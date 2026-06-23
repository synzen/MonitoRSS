import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Collapsible,
  HStack,
  Stack,
  Text,
  VisuallyHidden,
  chakra,
} from "@chakra-ui/react";
import { FaChevronRight } from "react-icons/fa6";
import { ConfirmModal } from "@/components/ConfirmModal";
import { DiscordUsername } from "@/features/discordUser";
import { useConvertWorkspaceBilling } from "../../hooks";
import { ConvertPersonalPlanFeedList } from "./ConvertPersonalPlanFeedList";

interface SharingInfo {
  sharedSelectedCount: number;
  affectedUserIds: string[];
  anyConnectionScoped: boolean;
}

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
  const [sharing, setSharing] = useState<SharingInfo | null>(null);
  // The under-limit feed list is a disclosure. Controlled so it can auto-open
  // when a sharing warning appears (revealing the per-row remedy) while the owner
  // can still collapse/expand it themselves.
  const [listOpen, setListOpen] = useState(false);
  // Initial focus lands on the intro text (top of the content) rather than the
  // Cancel button at the end of the DOM, so a keyboard/AT user reads forward
  // through the warning, feed list, and phrase input in order instead of being
  // dropped past all of it. See the role="dialog" note below.
  const introRef = useRef<HTMLParagraphElement>(null);

  // Stable so the feed list's effect that calls it does not re-run on every
  // render (it lists onSharingChange as a dependency).
  const onSharingChange = useCallback((info: SharingInfo) => setSharing(info), []);

  // Reset the per-open selection state whenever the dialog closes, so reopening
  // re-seeds from scratch rather than reusing a stale selection.
  useEffect(() => {
    if (!open) {
      setSelectedIds(new Set());
      setLoadInfo(null);
      setSharing(null);
      setListOpen(false);
    }
  }, [open]);

  // Auto-open the list once a shared feed is in the selection, so the warning's
  // remedy (unselect a shared feed to keep it personal) is visible without an
  // extra click. Does not force it back open afterward — the owner stays in
  // control once it is revealed.
  const hasSharedSelected = (sharing?.sharedSelectedCount ?? 0) > 0;

  useEffect(() => {
    if (hasSharedSelected) {
      setListOpen(true);
    }
  }, [hasSharedSelected]);

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
      onSharingChange={onSharingChange}
    />
  );

  const sharedSelectedCount = sharing?.sharedSelectedCount ?? 0;
  const affectedUserIds = sharing?.affectedUserIds ?? [];

  // A single, stable sentence carrying the whole warning, used as the LIVE
  // announcement. It is name-free on purpose: names resolve asynchronously
  // (DiscordUsername fetches), and a value that mutates inside an aria-live
  // region either announces mid-spinner or re-announces the whole alert on every
  // name resolution. The spoken warning must be complete the moment it fires, so
  // the async names are rendered OUTSIDE the live region (below), as a visual /
  // queryable supplement that the urgent announcement does not depend on.
  const liveMessage =
    sharedSelectedCount > 0
      ? `${
          sharedSelectedCount === 1
            ? "1 feed you are moving is shared with other people."
            : `${sharedSelectedCount} feeds you are moving are shared with other people.`
        } Feed sharing does not move into a workspace. The people who help manage these feeds will lose access until you invite them to the workspace as members.${
          sharing?.anyConnectionScoped
            ? " Some had access to only specific connections; in a workspace they would have access to the whole feed."
            : ""
        }`
      : "";

  // Only warn when a SELECTED feed is shared (an unselected shared feed stays
  // personal with its sharing intact, so there is nothing to warn about). Placed
  // above the feed list / disclosure so it is seen even when the list is
  // collapsed.
  // The VISIBLE warning. The whole alert is aria-hidden: its prose (and a stable,
  // name-free copy) is announced once via the single live region below, so
  // assistive tech is not told the same thing twice and never reads a
  // half-resolved name list. aria-hidden sits on Alert.Root so the alert's own
  // status role is removed from the accessibility tree entirely, leaving exactly
  // one live region (the VisuallyHidden status).
  const sharingWarning =
    sharedSelectedCount > 0 ? (
      <Alert.Root status="warning" aria-hidden>
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title display="block">
            {sharedSelectedCount === 1
              ? "1 feed you are moving is shared with other people"
              : `${sharedSelectedCount} feeds you are moving are shared with other people`}
          </Alert.Title>
          <Alert.Description display="block">
            Feed sharing does not move into a workspace. The people who help manage these feeds will
            lose access until you invite them to the workspace as members.
            {sharing?.anyConnectionScoped
              ? " Some had access to only specific connections. In a workspace they would have" +
                " access to the whole feed."
              : ""}
            {affectedUserIds.length > 0 ? (
              <chakra.span display="block" mt={1}>
                Affected:{" "}
                {affectedUserIds.map((id, index) => (
                  <Fragment key={id}>
                    {index > 0 ? ", " : ""}
                    <DiscordUsername userId={id} />
                  </Fragment>
                ))}
              </chakra.span>
            ) : null}
          </Alert.Description>
        </Alert.Content>
      </Alert.Root>
    ) : null;

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
      // wrong here. Initial focus goes to the top of the content (the intro) so a
      // keyboard/AT user reads forward through the warning and feed list rather
      // than landing on Cancel at the end of the DOM.
      role="dialog"
      initialFocusEl={() => introRef.current}
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
          {/* tabIndex={-1} makes this programmatically focusable as the dialog's
              initial focus target (it is not in the tab sequence otherwise). */}
          <Text ref={introRef} tabIndex={-1} outline="none">
            Your personal plan becomes the plan for this workspace, and the feeds you choose move
            with it. You will no longer have a personal plan. This is not easily reversible.
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
          {/* The single spoken source for the sharing warning. Carries the full,
              stable, name-free sentence so it announces complete the moment a
              shared feed is selected; the visible Alert above is aria-hidden to
              avoid a double read. */}
          <VisuallyHidden role="status" aria-live="polite">
            {liveMessage}
          </VisuallyHidden>
          {sharingWarning}
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
