import { useEffect, useRef, useState, type RefObject } from "react";
import {
  Badge,
  Box,
  BreadcrumbCurrentLink,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbRoot,
  BreadcrumbSeparator,
  Button,
  Flex,
  Heading,
  HStack,
  Link,
  Spinner,
  Stack,
  StackSeparator,
  Text,
  VisuallyHidden,
} from "@chakra-ui/react";
import dayjs from "dayjs";
import { captureException } from "@sentry/react";
import { FaChevronRight } from "react-icons/fa6";
import { Link as RouterLink, useSearchParams } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmModal } from "@/components/ConfirmModal";
import { DestructiveActionButton } from "@/components/DestructiveActionButton";
import { InlineErrorAlert } from "@/components/InlineErrorAlert";
import { PrimaryActionButton } from "@/components/PrimaryActionButton";
import { SafeLoadingButton } from "@/components/SafeLoadingButton";
import { SettingsSection } from "@/components/SettingsSection";
import { usePageAlertContext } from "@/contexts/PageAlertContext";
import {
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
  DialogCloseTrigger,
} from "@/components/ui/dialog";
import { pages, PRICE_IDS, getPlanDisplayName, ProductKey } from "@/constants";
import {
  usePaddleContext,
  CheckoutLoadingFrame,
  CHECKOUT_ANNOUNCEMENTS,
  PAYMENT_UPDATE_ANNOUNCEMENTS,
} from "@/features/subscriptionProducts";
import {
  useWorkspaceSliderPrice,
  feedCountToAddonQuantity,
  workspaceFeedPricingFromProducts,
  WORKSPACE_BASE_FEEDS,
  WorkspaceFeedPricing,
} from "@/shared/workspaceCapacity";
import {
  CapacitySlider,
  CapacitySummary,
  CapacityCompareColumn,
  detentIndexForFeeds,
  feedsForDetentIndex,
} from "./CapacitySlider";
import type { PricePreview } from "@/types/PricePreview";
import { useCurrentWorkspace } from "../../contexts/CurrentWorkspaceContext";
import type { Workspace } from "../../types";
import {
  useWorkspace,
  useCancelWorkspaceBilling,
  useResumeWorkspaceBilling,
  useUpdateWorkspaceBilling,
  useWorkspaceBillingChangePreview,
  useWorkspaceUpdatePaymentMethodTransaction,
  useWorkspaceActivationPolling,
} from "../../hooks";
import { ConvertPersonalPlanDialog } from "./ConvertPersonalPlanDialog";
import { TIER_FEED_LIMITS, capacityPlanLabel, type WorkspaceTier } from "./plans";

type BillingInterval = "month" | "year";

// Plan metadata (tiers, feed limits, labels, features) lives in ./plans so this
// file stays within the max-lines budget. Re-export the feed limits so the
// client/backend drift guard test can keep importing them from the component.
export { TIER_FEED_LIMITS };

// One labelled row in the change-capacity dialog's "Due today" breakdown.
// Rendered as a description term/detail pair so the amounts read as a real
// itemized list to assistive tech, not visually-aligned prose.
const AmountRow = ({
  label,
  value,
  emphasized,
  valueColor,
}: {
  label: string;
  value: string;
  emphasized?: boolean;
  valueColor?: string;
}) => (
  <HStack as="div" justifyContent="space-between" gap={4}>
    <Text as="dt" fontSize="sm" color={emphasized ? undefined : "fg.muted"}>
      {label}
    </Text>
    <Text as="dd" fontSize="sm" fontWeight={emphasized ? "bold" : "normal"} color={valueColor}>
      {value}
    </Text>
  </HStack>
);

// Entry point for moving the owner's personal subscription into this workspace. Only
// rendered for an unsubscribed workspace; the parent gates it further on the
// server-computed `conversion` read model (owner + convertible personal plan).
const ConvertPersonalPlanSection = ({
  conversion,
  onStartConvert,
}: {
  conversion: NonNullable<Workspace["conversion"]>;
  onStartConvert: () => void;
}) => {
  if (!conversion.eligible) {
    return (
      <Text fontSize="sm" color="fg.muted">
        Your personal plan can&apos;t fund a workspace. Buy a workspace plan directly using one of
        the options below.
      </Text>
    );
  }

  // A distinct "shortcut lane" sitting above the purchase flow: subtle surface
  // (not a tier card) so it reads as an alternative route, with a secondary
  // outline button that does not compete with the tier cards' primary CTAs.
  return (
    <Flex
      maxW="40rem"
      bg="bg.subtle"
      borderWidth="1px"
      borderColor="border.emphasized"
      borderRadius="md"
      padding={4}
      gap={4}
      direction={{ base: "column", md: "row" }}
      alignItems={{ base: "stretch", md: "center" }}
      justifyContent="space-between"
    >
      <Stack gap={1}>
        <Text fontWeight="medium">Already paying for a personal plan?</Text>
        <Text fontSize="sm" color="fg.muted">
          Move it to this workspace and bring your feeds, instead of paying for two plans.
        </Text>
      </Stack>
      <Button variant="outline" onClick={onStartConvert} flexShrink={0}>
        Move my plan to this workspace
      </Button>
    </Flex>
  );
};

// The two workspace checkout actions the dialog below can host. Subscribe
// carries the basket + workspace id; updating the card carries a pre-minted
// Paddle transaction. Both render Paddle inline (see WorkspaceCheckoutDialog).
type WorkspaceCheckoutIntent =
  | {
      kind: "subscribe";
      prices: Array<{ priceId: string; quantity: number }>;
      workspaceId: string;
      title: string;
    }
  | { kind: "updatePaymentMethod"; transactionId: string; title: string };

// The class Paddle renders its inline checkout frame into. A stable string (not
// a generated id) because Paddle selects the target by class name.
const CHECKOUT_FRAME_CLASS = "workspace-checkout-frame";

// Hosts the Paddle checkout INLINE inside a Chakra modal dialog rather than
// Paddle's own overlay. Paddle's overlay is a document.body sibling that never
// inerts the host page, so focus and Tab leak to the controls behind it. A
// Chakra dialog inerts its siblings, giving a correct focus trap; because the
// inline frame renders INSIDE the dialog, the dialog's inert excludes it (an
// OVERLAY-mode frame, a body sibling, would instead be inerted and unclickable).
// The dialog is titled so it announces itself to screen readers on open. The
// frame itself carries a polite, busy live region (see the body) so the wait
// for Paddle to paint, and a stall fallback, are announced too.
const WorkspaceCheckoutDialog = ({
  intent,
  onCancel,
  onCompleted,
}: {
  intent: WorkspaceCheckoutIntent | null;
  onCancel: () => void;
  onCompleted: () => void;
}) => {
  const { openCheckout, updatePaymentMethod, resetCheckoutData, checkoutLoadedData } =
    usePaddleContext();
  const [frameEl, setFrameEl] = useState<HTMLDivElement | null>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const isCheckoutLoaded = !!checkoutLoadedData;
  // Update-payment hosts the same Paddle frame as a purchase, but announcing
  // "checkout" there would make a user think they are buying again; use the
  // payment-update vocabulary for that intent.
  const announcements =
    intent?.kind === "updatePaymentMethod" ? PAYMENT_UPDATE_ANNOUNCEMENTS : CHECKOUT_ANNOUNCEMENTS;

  // Open Paddle only once both the intent and the frame container exist: Paddle
  // resolves the frameTarget class synchronously, so the container must be in
  // the DOM first. A callback ref drives a state update, so this re-runs after
  // the dialog content (portalled) commits and the frame is mountable.
  useEffect(() => {
    if (!intent || !frameEl) {
      return;
    }

    if (intent.kind === "subscribe") {
      openCheckout({
        prices: intent.prices,
        frameTarget: CHECKOUT_FRAME_CLASS,
        customData: { workspaceId: intent.workspaceId },
        onClose: onCancel,
        onCompleted,
      });
    } else {
      updatePaymentMethod(intent.transactionId, {
        frameTarget: CHECKOUT_FRAME_CLASS,
        onClose: onCancel,
        onCompleted,
      });
    }
  }, [intent, frameEl]);

  // Clear Paddle's per-checkout state when the dialog closes so a second open
  // starts clean instead of replaying the previous summary.
  useEffect(() => {
    if (!intent) {
      resetCheckoutData();
    }
  }, [intent]);

  return (
    <DialogRoot
      open={!!intent}
      onOpenChange={(e) => !e.open && onCancel()}
      size="lg"
      scrollBehavior="inside"
      // A stray backdrop click must not discard a half-entered card; the user
      // dismisses deliberately via Escape or the close button.
      closeOnInteractOutside={false}
      // Land focus on the title, not the close button (the default first
      // focusable), so the dialog announces what it is on open instead of "Close
      // button" with no context.
      initialFocusEl={() => titleRef.current}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle ref={titleRef} tabIndex={-1}>
            {intent?.title}
          </DialogTitle>
        </DialogHeader>
        <DialogCloseTrigger />
        <DialogBody>
          <Stack gap={3}>
            <DialogDescription>Payment is handled securely by Paddle.</DialogDescription>
            <CheckoutLoadingFrame
              frameClassName={CHECKOUT_FRAME_CLASS}
              frameRef={setFrameEl}
              isLoaded={isCheckoutLoaded}
              isOpen={!!intent}
              announcements={announcements}
            />
          </Stack>
        </DialogBody>
      </DialogContent>
    </DialogRoot>
  );
};

// The "Update payment method" entry on an existing subscription. Mints a Paddle
// transaction, then hands it to the page-level checkout dialog. The button
// keeps owning its retry/error UI; the dialog owns the focus trap.
const WorkspacePaymentMethodSection = ({
  workspaceSlug,
  onStartUpdatePayment,
}: {
  workspaceSlug: string;
  onStartUpdatePayment: (transactionId: string, opener: HTMLElement | null) => void;
}) => {
  const { error, fetchStatus, refetch } = useWorkspaceUpdatePaymentMethodTransaction(workspaceSlug);
  const openerRef = useRef<HTMLButtonElement | null>(null);

  // Each click re-mints a transaction, so a failed attempt must stay retryable:
  // refetch() resolves (it does not reject) and clears the previous error on a
  // fresh fetch, so the error is purely for display and never blocks re-click.
  const onClick = async () => {
    try {
      const result = await refetch();
      const transactionId = result.data?.data.paddleTransactionId;

      if (!transactionId) {
        return;
      }

      onStartUpdatePayment(transactionId, openerRef.current);
    } catch (err) {
      captureException(err);
    }
  };

  return (
    <SettingsSection
      title="Payment method"
      description="Replace the card on file for this workspace's subscription. A secure Paddle checkout opens to enter the new card; details are not stored here."
    >
      <Stack gap={3} alignItems="flex-start">
        <SafeLoadingButton
          ref={openerRef}
          variant="outline"
          // Tells a screen reader, on focus, that activating this opens a dialog.
          aria-haspopup="dialog"
          loading={fetchStatus === "fetching"}
          onClick={onClick}
        >
          Update payment method
        </SafeLoadingButton>
        {error && (
          <InlineErrorAlert
            title="Failed to start payment method update"
            description={error.message}
          />
        )}
      </Stack>
    </SettingsSection>
  );
};

// The change-capacity dialog for a subscribed owner: one slider seeded at the
// workspace's current capacity drives a live prorated preview and the confirm.
// An increase shows the plain new price; a DECREASE shows a "Now -> After" diff
// and the "feeds will be disabled" consequence, because that is the direction
// that disables feeds. The basket is the same base-tier-plus-add-on shape the
// activation slider builds, so buy and manage are billed identically.
const ChangeCapacityDialog = ({
  open,
  onClose,
  workspaceSlug,
  currentFeeds,
  interval,
  nextBillDate,
  pricing,
  buildBasket,
  triggerRef,
  successFocusRef,
}: {
  open: boolean;
  onClose: () => void;
  workspaceSlug: string;
  currentFeeds: number;
  interval: BillingInterval;
  nextBillDate: string | null;
  // Base + per-feed unit prices for the subscribed interval, from the page's
  // single preview. Undefined while it loads. Drives the slider's derived totals.
  pricing: WorkspaceFeedPricing | undefined;
  buildBasket: (feeds: number) => Array<{ priceId: string; quantity: number }>;
  // Cancel restores focus to the trigger (the button that opened the dialog).
  triggerRef: RefObject<HTMLButtonElement | null>;
  // A successful change sends focus to the page heading instead: returning to the
  // trigger would announce that button and its "Change capacity" group over the
  // success alert, while the heading is a stable, brief target that does not.
  successFocusRef: RefObject<HTMLElement | null>;
}) => {
  // The trigger stays mounted, so Ark's default would restore focus to it on
  // every close. A success close needs the heading instead; this ref, set just
  // before the success-driven close, tells finalFocusEl which target to pick.
  // Reset on (re)open so a later cancel restores to the trigger normally.
  const closingForSuccessRef = useRef(false);
  // Seed at the current capacity. detentIndexForFeeds rounds a non-detent
  // capacity UP to the next detent, which would open the dialog already "dirty"
  // (preview fires, Confirm enabled) with no user action and let a no-move
  // confirm silently raise capacity. So clamp the seeded count back to the
  // current capacity for the dirty check: an untouched dialog is never dirty.
  const seededIndex = detentIndexForFeeds(currentFeeds);
  const [index, setIndex] = useState(seededIndex);
  // Re-seat whenever the dialog (re)opens or the current capacity changes.
  useEffect(() => {
    if (open) {
      closingForSuccessRef.current = false;
      setIndex(detentIndexForFeeds(currentFeeds));
    }
  }, [open, currentFeeds]);

  // The detent the slider sits on; nextFeeds is that detent's feed count, except
  // while the slider is still on its seeded position, where the real current
  // capacity (which may sit between detents) is the effective target so the
  // dialog opens clean.
  const onSeededDetent = index === seededIndex;
  const nextFeeds = onSeededDetent ? currentFeeds : feedsForDetentIndex(index);
  const dirty = nextFeeds !== currentFeeds;
  const prices = buildBasket(nextFeeds);

  const { price: recurringPrice } = useWorkspaceSliderPrice({ feeds: nextFeeds, pricing });

  const { createSuccessAlert } = usePageAlertContext();
  const { preview, status, error } = useWorkspaceBillingChangePreview({
    workspaceSlug,
    prices,
    enabled: open && dirty,
  });
  const updateMutation = useUpdateWorkspaceBilling();

  const immediate = preview?.immediateTransaction;
  const willBeDisabledCount = preview?.feedImpact?.willBeDisabledCount ?? 0;
  const newFeedLimit = preview?.feedImpact?.newFeedLimit;

  const onConfirm = async () => {
    const confirmedFeeds = nextFeeds;
    const decreasing = confirmedFeeds < currentFeeds;
    await updateMutation.mutateAsync({ workspaceSlug, prices });
    // Mark this as a success close so finalFocusEl sends focus to the heading
    // (not the trigger, whose name/group would be announced over the alert).
    closingForSuccessRef.current = true;
    onClose();
    // "can now run up to" reads as an upgrade; for a decrease (which just
    // disabled feeds) state the new capacity plainly instead.
    const description = decreasing
      ? `This workspace's capacity is now ${confirmedFeeds} feeds.`
      : `This workspace can now run up to ${confirmedFeeds} feeds.`;
    // The visible alert (role="alert", via the always-mounted page outlet) is
    // both the durable on-screen confirmation and the announcement. Defer it past
    // the close: while the modal is open it inerts the rest of the page including
    // the alert outlet, and an alert mounted into an inert subtree is not
    // announced. After the close the node mounts into a live page and its
    // insertion is what the screen reader speaks.
    window.setTimeout(() => {
      createSuccessAlert({ title: "Capacity updated", description });
    }, 0);
  };

  return (
    <DialogRoot
      open={open}
      onOpenChange={(e) => !e.open && onClose()}
      size="lg"
      // Cancel restores focus to the trigger; a successful change sends focus to
      // the page heading instead, so the trigger is not announced over the alert.
      finalFocusEl={() =>
        closingForSuccessRef.current ? successFocusRef.current : triggerRef.current
      }
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle as="h2">Change capacity</DialogTitle>
        </DialogHeader>
        <DialogCloseTrigger />
        <DialogBody>
          <Stack gap={5}>
            <DialogDescription>
              You&apos;re currently on {currentFeeds} feeds. Pick a new capacity.
            </DialogDescription>
            <CapacitySlider index={index} onChange={setIndex} />
            {/* One always-mounted polite live region carries the before/after
                summary so increases and decreases announce through the same node.
                The slider sits above it so its own value announcements are not
                re-read and it never remounts across slider moves (thumb focus is
                preserved). The "Now -> After" comparison renders the same way in
                both directions; only the disabled-feed warning below is
                decrease-specific. */}
            <Box aria-live="polite" aria-busy={!recurringPrice}>
              <VisuallyHidden>
                Changing capacity from {currentFeeds} feeds to {nextFeeds} feeds,{" "}
                {recurringPrice ?? "updating price"} per {interval}.
              </VisuallyHidden>
              <HStack gap={4} alignItems="stretch" aria-hidden>
                <CapacityCompareColumn heading="Now" feeds={currentFeeds} />
                <CapacityCompareColumn
                  heading="After"
                  feeds={nextFeeds}
                  price={recurringPrice}
                  interval={interval}
                  emphasized
                />
              </HStack>
            </Box>
            {/* The consequence is the most important message in the flow, so it
                gets its own polite live region: announced when it appears as the
                owner crosses below the current capacity. */}
            {willBeDisabledCount > 0 && (
              <Box aria-live="polite">
                <Text color="text.warning" fontSize="sm">
                  {willBeDisabledCount} feed{willBeDisabledCount === 1 ? "" : "s"} over the new{" "}
                  {newFeedLimit}-feed limit will be disabled (not deleted). They re-enable if you
                  raise capacity again.
                </Text>
              </Box>
            )}
            {/* One always-mounted polite region spans the loading -> loaded
                transition for the prorated breakdown so the screen reader observes
                the swap within a stable region. While loading it holds the place of
                the "Due today" breakdown with skeleton rows the shape of AmountRow
                so the dialog does not jump when figures arrive (skeletons
                decorative). aria-busy holds the announcement until the preview
                settles; the sr-only line then states the total once, so a
                screen-reader user hears the cost without navigating the breakdown. */}
            {(immediate || (dirty && status === "loading")) && (
              <Box aria-live="polite" aria-busy={status === "loading"}>
                {dirty && status === "loading" && (
                  <Stack gap={1} aria-label="Loading change preview">
                    <Skeleton height="4" width="24" />
                    <Skeleton height="4" width="full" />
                    <Skeleton height="4" width="full" />
                    <Skeleton height="5" width="full" />
                  </Stack>
                )}
                {immediate && (
                  <Stack gap={3}>
                    <VisuallyHidden>
                      Preview ready. You&apos;ll pay {immediate.grandTotalFormatted} now.
                    </VisuallyHidden>
                    <Stack gap={1}>
                      <Text fontWeight="medium" fontSize="sm">
                        Due today
                      </Text>
                      <Stack as="dl" gap={1}>
                        <AmountRow label="Subtotal" value={immediate.subtotalFormatted} />
                        <AmountRow label="Tax" value={immediate.taxFormatted} />
                        {immediate.credit !== "0" && (
                          <AmountRow
                            label="Account credit"
                            value={`-${immediate.creditFormatted}`}
                            valueColor="text.success"
                          />
                        )}
                        <Box borderTopWidth="1px" borderColor="border.emphasized" pt={1}>
                          <AmountRow
                            label="Total due today"
                            value={immediate.grandTotalFormatted}
                            emphasized
                          />
                        </Box>
                      </Stack>
                      <Text color="fg.muted" fontSize="xs">
                        Prorated for the current billing period.
                      </Text>
                    </Stack>
                    {recurringPrice && (
                      <Stack gap={1}>
                        <Text fontWeight="medium" fontSize="sm">
                          Then
                        </Text>
                        <Text fontSize="sm">
                          {recurringPrice} / {interval}
                          {nextBillDate
                            ? `, starting ${dayjs(nextBillDate).format("D MMMM YYYY")}`
                            : ""}
                          .
                        </Text>
                        <Text color="fg.muted" fontSize="xs">
                          Renews automatically. Cancel anytime.
                        </Text>
                      </Stack>
                    )}
                  </Stack>
                )}
              </Box>
            )}
            {error && (
              <InlineErrorAlert title="Failed to load change preview" description={error.message} />
            )}
            {updateMutation.error && (
              <InlineErrorAlert
                title="Failed to change capacity"
                description={updateMutation.error.message}
              />
            )}
          </Stack>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <PrimaryActionButton
            onClick={onConfirm}
            loading={updateMutation.status === "loading"}
            disabled={!dirty || !preview}
          >
            Confirm change
          </PrimaryActionButton>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
};

export const WorkspaceBilling = () => {
  const { isConfigured, isLoaded, getPricePreview } = usePaddleContext();
  const currentWorkspace = useCurrentWorkspace();
  const { workspace, refetch } = useWorkspace({
    workspaceSlug: currentWorkspace?.slug,
  });

  const cancelMutation = useCancelWorkspaceBilling();
  const resumeMutation = useResumeWorkspaceBilling();

  const [products, setProducts] = useState<PricePreview[]>();
  const [pricesError, setPricesError] = useState(false);
  const [interval, setInterval] = useState<BillingInterval>("month");
  // The capacity the owner picks before activating, expressed as a detent index
  // (see CapacitySlider). Seeded from the pricing dialog's "?feeds=N" hand-off so
  // the capacity chosen on the buy-time slider carries into activation, seated on
  // the next detent at or above the requested count.
  const [searchParams] = useSearchParams();
  const requestedFeeds = Number(searchParams.get("feeds"));
  const [activationIndex, setActivationIndex] = useState(() =>
    Number.isFinite(requestedFeeds) && requestedFeeds > WORKSPACE_BASE_FEEDS
      ? detentIndexForFeeds(requestedFeeds)
      : 0,
  );
  const [isConvertOpen, setIsConvertOpen] = useState(false);
  // The change-capacity dialog (subscribed owners). Focus returns to its trigger
  // on close, mirroring the checkout-dialog focus discipline.
  const [isChangeCapacityOpen, setIsChangeCapacityOpen] = useState(false);
  const changeCapacityTriggerRef = useRef<HTMLButtonElement>(null);
  // The checkout dialog is page-level so its focus trap is unaffected by where
  // the triggering button lives. We still own the two return trips:
  //  - Cancel (onClose): nothing changed, so return focus to the button that
  //    opened the dialog (the dialog itself only restores focus to its trigger,
  //    which for the update-payment flow lives in a child component).
  //  - Complete (onCompleted): the page transitions and the opener unmounts, so
  //    returning focus there is meaningless. Move focus to the page heading,
  //    which is always present and survives the confirming -> active swap.
  const [checkoutIntent, setCheckoutIntent] = useState<WorkspaceCheckoutIntent | null>(null);
  const checkoutOpenerRef = useRef<HTMLElement | null>(null);
  // The page heading is always rendered, so it is a stable focus target across
  // the confirming -> active transition. The transient "Confirming" status
  // region unmounts when the subscription lands, so focus must not live there.
  const headingRef = useRef<HTMLHeadingElement | null>(null);

  const isOwner = currentWorkspace?.myRole === "owner";
  const subscription = workspace?.subscription ?? null;
  const conversion = workspace?.conversion ?? null;
  const workspaceSlug = currentWorkspace?.slug ?? "";

  // After checkout (or a personal-plan conversion) completes, the webhook
  // activates the workspace asynchronously; this polls the workspace read until
  // the subscription lands and drives the two-stage activation announcement.
  const { awaitingActivation, beginActivation, billingAnnouncement } =
    useWorkspaceActivationPolling({
      workspaceId: currentWorkspace?.id,
      subscription,
      refetch,
    });

  // One price preview powers every capacity slider on this page: it carries the
  // Tier2 base and Tier3Feed per-feed unit prices for both intervals, from which
  // the slider derives any detent's total locally. So this is the page's only
  // pricing round-trip, no matter how the owner drags the slider or toggles the
  // interval. Owners are the only ones who can subscribe, so gate on ownership.
  useEffect(() => {
    if (!isConfigured || !isLoaded || !isOwner) {
      return;
    }

    getPricePreview([
      { priceId: PRICE_IDS[ProductKey.Tier2].month, quantity: 1 },
      { priceId: PRICE_IDS[ProductKey.Tier2].year, quantity: 1 },
      { priceId: PRICE_IDS[ProductKey.Tier3Feed].month, quantity: 1 },
      { priceId: PRICE_IDS[ProductKey.Tier3Feed].year, quantity: 1 },
    ])
      .then(setProducts)
      .catch(() => setPricesError(true));
  }, [isConfigured, isLoaded, isOwner]);

  // The slider's pricing inputs for an interval, derived from that single preview.
  // The lookup is shared with the pricing dialog (ADR-009).
  const feedPricingFor = (forInterval: BillingInterval) =>
    workspaceFeedPricingFromProducts(products, forInterval);

  // Live recurring price for the activation slider's chosen capacity. Hooks must
  // run before the early return below, so this lives here even though it only
  // feeds the unsubscribed activation view.
  const activationFeeds = feedsForDetentIndex(activationIndex);
  const { price: activationPrice } = useWorkspaceSliderPrice({
    feeds: activationFeeds,
    pricing: feedPricingFor(interval),
  });

  if (!isConfigured || !currentWorkspace) {
    return null;
  }

  // Every capacity maps to one real purchasable basket: the base workspace tier
  // plus a per-feed add-on for the overage above the base. The buy moment (here)
  // and the manage moment (change-capacity) build the same basket, so a workspace
  // is billed identically however the capacity was chosen.
  const capacityBasket = (feeds: number, useInterval: BillingInterval) => {
    const addonFeeds = feedCountToAddonQuantity(feeds);

    return [
      { priceId: PRICE_IDS[ProductKey.Tier2][useInterval], quantity: 1 },
      ...(addonFeeds > 0
        ? [{ priceId: PRICE_IDS[ProductKey.Tier3Feed][useInterval], quantity: addonFeeds }]
        : []),
    ];
  };

  const subscribeToCapacity = (feeds: number) => {
    // Remember the button that opened the dialog so focus can return to it on
    // cancel.
    checkoutOpenerRef.current = document.activeElement as HTMLElement | null;

    setCheckoutIntent({
      kind: "subscribe",
      prices: capacityBasket(feeds, interval),
      workspaceId: currentWorkspace.id,
      title: `Subscribe to ${capacityPlanLabel(feeds)}`,
    });
  };

  // Cancelled: the page is unchanged, so close the dialog and send focus back to
  // the button that opened it. Defer the focus past the close so it is not
  // overwritten by the dialog's own focus-restore (which lands on its trigger).
  const onCheckoutCancel = () => {
    setCheckoutIntent(null);
    window.setTimeout(() => checkoutOpenerRef.current?.focus?.(), 0);
  };

  // Paid: record the pending activation (survives a navigate-away) and close the
  // dialog. The opener button unmounts as the page transitions, so Chakra's
  // focus-restore would land on a detached node (dropping focus to the body);
  // move focus to the always-present page heading instead. The heading is a
  // stable target that survives the confirming -> active swap, unlike the
  // transient status region, so focus is never lost mid-transition. The polite
  // status region still announces "Confirming"; it is no longer the focus
  // target, so its later unmount cannot strand focus.
  const onCheckoutCompleted = () => {
    beginActivation();
    setCheckoutIntent(null);
    window.setTimeout(() => headingRef.current?.focus?.(), 0);
  };

  const subscriptionInterval = (subscription?.billingInterval ?? "month") as BillingInterval;
  const currentTier = subscription?.productKey as WorkspaceTier | undefined;
  const currentAddonQuantity =
    subscription?.addons?.find((a) => a.key === ProductKey.Tier3Feed)?.quantity ?? 0;
  // The workspace's current total capacity = its base tier's feed limit plus any
  // per-feed add-ons. Seeds the change-capacity slider.
  const currentCapacityFeeds = currentTier
    ? TIER_FEED_LIMITS[currentTier] + currentAddonQuantity
    : WORKSPACE_BASE_FEEDS;

  const intervalToggle = (
    <HStack role="group" aria-label="Billing interval">
      <Button
        size="sm"
        variant={interval === "month" ? "solid" : "outline"}
        aria-pressed={interval === "month"}
        onClick={() => setInterval("month")}
      >
        Monthly
      </Button>
      <Button
        size="sm"
        variant={interval === "year" ? "solid" : "outline"}
        aria-pressed={interval === "year"}
        onClick={() => setInterval("year")}
      >
        Yearly
      </Button>
    </HStack>
  );

  return (
    <Stack gap={8}>
      <BreadcrumbRoot>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <RouterLink to={pages.workspaceSettings(currentWorkspace.slug)}>
                Workspace settings
              </RouterLink>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator>
            <FaChevronRight />
          </BreadcrumbSeparator>
          <BreadcrumbItem>
            <BreadcrumbCurrentLink>Billing</BreadcrumbCurrentLink>
          </BreadcrumbItem>
        </BreadcrumbList>
      </BreadcrumbRoot>
      <Stack gap={2}>
        <Heading as="h1" size="lg" ref={headingRef} tabIndex={-1} outline="none">
          Billing
        </Heading>
        <Text color="fg.muted">
          Manage the subscription that powers {currentWorkspace.name}&apos;s feeds.
        </Text>
      </Stack>
      {/* Activation outcomes (payment captured, then activation complete) go
          through one persistent polite live region so each is announced once and
          the text is fully under our control. A capacity change announces through
          the shared page alert instead (createSuccessAlert), so it is not routed
          here. The visible spinner below is decorative; it no longer carries its
          own live role. */}
      <VisuallyHidden role="status">{billingAnnouncement}</VisuallyHidden>
      {awaitingActivation && !subscription && (
        <Box>
          <HStack>
            <Spinner size="sm" />
            <Text>Confirming your subscription…</Text>
          </HStack>
        </Box>
      )}
      {subscription ? (
        <Stack gap={10} separator={<StackSeparator />}>
          <SettingsSection
            title="Current plan"
            description="The workspace's active subscription and its renewal schedule."
          >
            {/* Plan name, capacity, and renewal status are one block of plan
                facts, so they sit tight together; the section's larger gap is
                reserved for separating this block from the actions below. */}
            <Stack gap={1}>
              <HStack gap={3}>
                <Text fontWeight="bold">
                  {getPlanDisplayName(subscription.productKey as ProductKey) ??
                    subscription.productKey}
                </Text>
                <Badge colorPalette={subscription.cancellationDate ? "orange" : "green"}>
                  {subscription.cancellationDate ? "Cancels soon" : subscription.status}
                </Badge>
              </HStack>
              {currentTier && (
                <Text color="fg.muted">
                  {currentAddonQuantity > 0
                    ? `${TIER_FEED_LIMITS[currentTier] + currentAddonQuantity} feeds (${
                        TIER_FEED_LIMITS[currentTier]
                      } + ${currentAddonQuantity} additional)`
                    : `${TIER_FEED_LIMITS[currentTier]} feeds`}
                </Text>
              )}
              {subscription.cancellationDate ? (
                <Text>
                  Your subscription will be canceled on{" "}
                  {dayjs(subscription.cancellationDate).format("D MMMM YYYY")}. Feeds stay active
                  until then.
                </Text>
              ) : (
                subscription.nextBillDate && (
                  <Text color="fg.muted">
                    Renews on {dayjs(subscription.nextBillDate).format("D MMMM YYYY")}.
                  </Text>
                )
              )}
              {subscription.billingEmail && (
                <Text color="fg.muted">
                  Billed to{" "}
                  <Text as="span" color="fg">
                    {subscription.billingEmail}
                  </Text>
                </Text>
              )}
            </Stack>
            {!isOwner && <Text>Only the workspace owner can manage billing.</Text>}
            {isOwner && subscription.cancellationDate && (
              <Box>
                <PrimaryActionButton
                  onClick={() => resumeMutation.mutateAsync({ workspaceSlug })}
                  loading={resumeMutation.status === "loading"}
                >
                  Keep subscription
                </PrimaryActionButton>
              </Box>
            )}
          </SettingsSection>
          {isOwner && (
            <WorkspacePaymentMethodSection
              workspaceSlug={workspaceSlug}
              onStartUpdatePayment={(transactionId, opener) => {
                checkoutOpenerRef.current = opener;
                setCheckoutIntent({
                  kind: "updatePaymentMethod",
                  transactionId,
                  title: "Update payment method",
                });
              }}
            />
          )}
          {isOwner && !subscription.cancellationDate && (
            <SettingsSection
              title="Change capacity"
              description="Adjust how many feeds this workspace can run. You will see the prorated cost before confirming."
            >
              <Box>
                <PrimaryActionButton
                  ref={changeCapacityTriggerRef}
                  aria-haspopup="dialog"
                  onClick={() => setIsChangeCapacityOpen(true)}
                >
                  Change capacity
                </PrimaryActionButton>
              </Box>
            </SettingsSection>
          )}
          {isOwner && !subscription.cancellationDate && (
            <SettingsSection
              title="Cancel subscription"
              description="Stops the workspace's subscription at the end of the current billing period."
            >
              <Box>
                <ConfirmModal
                  title="Cancel workspace subscription?"
                  description="The subscription stays active until the end of the paid period. After that, the workspace's feeds are disabled (not deleted) until you resubscribe."
                  okText="Confirm"
                  colorScheme="red"
                  error={cancelMutation.error?.message}
                  onConfirm={() => cancelMutation.mutateAsync({ workspaceSlug })}
                  trigger={<DestructiveActionButton>Cancel subscription</DestructiveActionButton>}
                />
              </Box>
            </SettingsSection>
          )}
        </Stack>
      ) : (
        <SettingsSection
          title="Activate this workspace"
          description={
            isOwner
              ? "Subscribe to enable feeds for this workspace. Members and settings keep working either way."
              : undefined
          }
        >
          {!isOwner ? (
            <Text>
              This workspace&apos;s feeds are paused until the owner activates a subscription. Ask
              the owner to activate it to turn feeds back on.
            </Text>
          ) : (
            <Stack gap={4}>
              {conversion && (
                <ConvertPersonalPlanSection
                  conversion={conversion}
                  onStartConvert={() => setIsConvertOpen(true)}
                />
              )}
              <HStack gap={3} flexWrap="wrap">
                {intervalToggle}
                <Badge colorPalette="green">Save 15% with a yearly plan!</Badge>
              </HStack>
              {/*
                Subscribing is the act of consent, so the terms it binds the
                owner to must be readable before the Subscribe buttons, not
                discovered after the overlay has already opened over them. Only
                the consent gate itself leads; the longer reassurance and Paddle
                disclosure are fine print, kept below the cards so the prices are
                not buried behind a wall of grey text.
              */}
              <Text fontSize="sm" color="fg.muted" maxW="40rem">
                By proceeding to payment, you are agreeing to our{" "}
                <Link target="_blank" href="https://monitorss.xyz/terms" color="text.link">
                  terms and conditions
                </Link>{" "}
                and our{" "}
                <Link target="_blank" href="https://monitorss.xyz/privacy-policy" color="text.link">
                  privacy policy
                </Link>
                .
              </Text>
              {pricesError && (
                <InlineErrorAlert
                  title="Failed to load prices"
                  description="Please try refreshing the page."
                />
              )}
              {/* One Team plan with a capacity slider, not a grid of tier cards.
                  The slider drives a live price (base tier + per-feed add-ons),
                  and a single Subscribe action buys exactly that capacity. */}
              <Stack gap={5} maxW="40rem">
                <Stack gap={1}>
                  <Heading as="h3" size="md">
                    {getPlanDisplayName(ProductKey.Tier2)}
                  </Heading>
                  <Text color="fg.muted" fontSize="sm">
                    Activate your subscription so your team can manage this workspace&apos;s feeds
                    together.
                  </Text>
                </Stack>
                <CapacitySummary
                  feeds={activationFeeds}
                  price={activationPrice}
                  interval={interval}
                />
                <CapacitySlider index={activationIndex} onChange={setActivationIndex} />
                <Box>
                  <PrimaryActionButton
                    onClick={() => subscribeToCapacity(activationFeeds)}
                    aria-haspopup="dialog"
                    aria-label={`Subscribe to ${getPlanDisplayName(
                      ProductKey.Tier2,
                    )}, ${activationFeeds} feeds total`}
                  >
                    Subscribe for {activationFeeds} feeds
                  </PrimaryActionButton>
                </Box>
              </Stack>
              {/* Reassurance and Paddle disclosure: fine print, not a consent
                  gate, so it sits below the cards. */}
              <Stack gap={1} maxW="40rem">
                <Text fontSize="sm" color="fg.muted">
                  Cancel anytime. Feeds stay active until the end of the paid period, and you can
                  switch tiers with prorated billing.
                </Text>
                <Text fontSize="sm" color="fg.muted">
                  The checkout process is handled by our reseller and Merchant of Record,
                  Paddle.com. Prices will be localized to your location.
                </Text>
              </Stack>
            </Stack>
          )}
        </SettingsSection>
      )}
      <WorkspaceCheckoutDialog
        intent={checkoutIntent}
        onCancel={onCheckoutCancel}
        onCompleted={onCheckoutCompleted}
      />
      <ChangeCapacityDialog
        open={isChangeCapacityOpen}
        onClose={() => setIsChangeCapacityOpen(false)}
        triggerRef={changeCapacityTriggerRef}
        successFocusRef={headingRef}
        workspaceSlug={workspaceSlug}
        currentFeeds={currentCapacityFeeds}
        interval={subscriptionInterval}
        nextBillDate={subscription?.nextBillDate ?? null}
        pricing={feedPricingFor(subscriptionInterval)}
        buildBasket={(feeds) => capacityBasket(feeds, subscriptionInterval)}
      />
      {conversion?.eligible && (
        <ConvertPersonalPlanDialog
          open={isConvertOpen}
          onClose={() => setIsConvertOpen(false)}
          onConverted={() => {
            // The subscription re-homes onto the workspace by webhook (the
            // endpoint polls for it), so show the same "confirming" state as a
            // fresh activation while the workspace read catches up. No payment
            // step here, so the announcement omits the "Payment successful" lead.
            beginActivation("Confirming your subscription…");
          }}
          workspaceSlug={workspaceSlug}
          feedLimit={conversion.feedLimit ?? 0}
          workspaceHasActiveRedditGrant={workspace?.redditConnection?.status === "ACTIVE"}
        />
      )}
    </Stack>
  );
};
