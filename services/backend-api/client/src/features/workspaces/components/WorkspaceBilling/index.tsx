import { useEffect, useRef, useState } from "react";
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
  Icon,
  Link,
  SimpleGrid,
  Spinner,
  Stack,
  StackSeparator,
  Text,
  VisuallyHidden,
} from "@chakra-ui/react";
import dayjs from "dayjs";
import { captureException } from "@sentry/react";
import { FaCheck, FaChevronRight } from "react-icons/fa6";
import { Link as RouterLink } from "react-router-dom";
import { ConfirmModal } from "@/components/ConfirmModal";
import { DestructiveActionButton } from "@/components/DestructiveActionButton";
import { NumberInputRoot, NumberInputField } from "@/components/ui/number-input";
import { InlineErrorAlert } from "@/components/InlineErrorAlert";
import { PrimaryActionButton } from "@/components/PrimaryActionButton";
import { SafeLoadingButton } from "@/components/SafeLoadingButton";
import { SettingsSection } from "@/components/SettingsSection";
import { Field } from "@/components/ui/field";
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
import { pages, PRICE_IDS, PRODUCT_NAMES, ProductKey, TIER_CONFIGS } from "@/constants";
import { usePaddleContext } from "@/features/subscriptionProducts";
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
} from "../../hooks";
import { useExpandableTierTotal } from "./useExpandableTierTotal";
import { ConvertPersonalPlanDialog } from "./ConvertPersonalPlanDialog";

type BillingInterval = "month" | "year";

const WORKSPACE_TIERS = [ProductKey.Tier2, ProductKey.Tier3] as const;
type WorkspaceTier = (typeof WORKSPACE_TIERS)[number];

// Whether a tier can be extended with the per-feed add-on, read from the shared
// tier config rather than hardcoding Tier 3 so the rule stays in one place.
const tierSupportsAddons = (tier: WorkspaceTier) =>
  TIER_CONFIGS.find((c) => c.productId === tier)?.supportsAdditionalFeeds ?? false;

// Must match the backend's WORKSPACE_TIER_FEED_LIMITS (shared/utils/billing.ts),
// which the activation webhook and change-preview both read. The client can't
// import across the package boundary, so a guard test (WorkspaceBilling.test)
// locks these values to keep the displayed limit and the granted limit in step.
export const TIER_FEED_LIMITS: Record<WorkspaceTier, number> = {
  [ProductKey.Tier2]: 70,
  [ProductKey.Tier3]: 140,
};

// Mirrors the benefits the activation webhook grants per tier
// (BENEFITS_BY_TIER in the backend paddle-webhooks service). Custom
// placeholders and external properties are personal-plan perks, not workspace
// ones, so they are deliberately absent.
const TIER_FEATURES: Record<WorkspaceTier, string[]> = {
  [ProductKey.Tier2]: [
    `Track ${TIER_FEED_LIMITS[ProductKey.Tier2]} news feeds`,
    "1000 articles daily per feed",
    "Branded message delivery",
    "2 minute refresh rate",
  ],
  [ProductKey.Tier3]: [
    `Track ${TIER_FEED_LIMITS[ProductKey.Tier3]} news feeds`,
    "Expandable with additional feeds",
    "1000 articles daily per feed",
    "Branded message delivery",
    "2 minute refresh rate",
  ],
};

// A single tier card, shared by the activation grid and the change-plan
// section so a subscribed owner deciding whether to switch sees the same
// price/limit/feature scent they had when first choosing a plan. The footer
// slot carries the context-specific action (subscribe, switch, or the
// non-interactive "current plan" state). The addonSlot, rendered just above the
// footer, lets an expandable tier surface its extra-feed control at the
// decision point; addonFeeds folds those extras into both the displayed feed
// total and the headline price, so the card reflects what the owner is actually
// buying. The price recomputes from Paddle's authoritative preview as the count
// changes.
const TierCard = ({
  tier,
  price,
  interval,
  recommended,
  current,
  addonFeeds = 0,
  addonSlot,
  footer,
  getChargePreview,
}: {
  tier: WorkspaceTier;
  price: string | undefined;
  interval: BillingInterval;
  recommended?: boolean;
  current?: boolean;
  addonFeeds?: number;
  addonSlot?: React.ReactNode;
  footer: React.ReactNode;
  getChargePreview: (
    items: Array<{ priceId: string; quantity: number }>,
  ) => Promise<{ totalFormatted: string }>;
}) => {
  const { price: effectivePrice, isUpdating } = useExpandableTierTotal({
    tier,
    addonFeeds,
    interval,
    basePrice: price,
    getChargePreview,
  });

  return (
    <Stack
      role="listitem"
      borderWidth="1px"
      borderColor={recommended || current ? "brandSolid" : "border.emphasized"}
      borderRadius="md"
      padding={4}
      gap={3}
    >
      <HStack justifyContent="space-between">
        <Heading as="h3" size="sm">
          {PRODUCT_NAMES[tier]}
        </Heading>
        {current && <Badge colorPalette="brand">Current plan</Badge>}
        {!current && recommended && <Badge colorPalette="brand">Recommended</Badge>}
      </HStack>
      {/*
        Price and feed count change together as the owner steps the add-on
        count, but the stepper announces neither on its own. Make the pair a
        polite live region so the settled summary ("$35.00 / month, 170 feeds")
        is read once. aria-busy holds the announcement until the debounced price
        resolves, so the instant feed-count change does not announce ahead of
        the price or spam intermediate amounts. The spinner is decorative.

        The region is only live once the owner is actually configuring add-ons
        (addonFeeds > 0). At rest it is aria-live="off" so that revealing the
        card (e.g. when the checkout dialog closes and its inert lifts off the
        page) does not make the screen reader re-read every card's price.
      */}
      <Box aria-live={addonFeeds > 0 ? "polite" : "off"} aria-busy={isUpdating}>
        <HStack gap={2}>
          <Text
            fontSize="2xl"
            fontWeight="bold"
            // Dim only while updating so a stale figure does not read as final.
            // Kept above 0.6 so the bold text stays within contrast even mid-update.
            opacity={isUpdating ? 0.65 : 1}
          >
            {effectivePrice ?? <Spinner size="sm" />}
            <Text as="span" fontSize="sm" fontWeight="normal" color="fg.muted">
              {" "}
              / {interval}
            </Text>
          </Text>
          {isUpdating && <Spinner size="sm" aria-hidden />}
        </HStack>
        <Text fontSize="sm" color="fg.muted">
          {addonFeeds > 0
            ? `${TIER_FEED_LIMITS[tier] + addonFeeds} feeds (${TIER_FEED_LIMITS[tier]} + ${addonFeeds})`
            : `${TIER_FEED_LIMITS[tier]} feeds`}
        </Text>
      </Box>
      <Stack as="ul" listStyleType="none" gap={2} flexGrow={1}>
        {TIER_FEATURES[tier].map((feature) => (
          <HStack key={feature} as="li" alignItems="flex-start">
            <Flex bg="brandSolid" rounded="full" p={1} mt={1} aria-hidden>
              <Icon width={3} height={3} color="brand.contrast">
                <FaCheck />
              </Icon>
            </Flex>
            <Text fontSize="sm">{feature}</Text>
          </HStack>
        ))}
      </Stack>
      {addonSlot}
      {footer}
    </Stack>
  );
};

// The extra-feed control for an expandable tier, rendered inside its TierCard so
// "Tier 3 + N feeds" is one decision and one transaction instead of a follow-up
// trip. Uses the native spinbutton primitive for keyboard/arrow support and
// min-clamping; announces the per-feed price as helper text.
const AdditionalFeedsControl = ({
  value,
  onChange,
  perFeedPrice,
  interval,
}: {
  value: number;
  onChange: (value: number) => void;
  perFeedPrice: string | undefined;
  interval: BillingInterval;
}) => (
  <Box borderTopWidth="1px" borderColor="border.emphasized" pt={3}>
    <Field label="Additional feeds">
      <NumberInputRoot
        min={0}
        value={String(value)}
        onValueChange={(e) => onChange(Math.max(0, Math.floor(e.valueAsNumber) || 0))}
        width="full"
      >
        <NumberInputField />
      </NumberInputRoot>
    </Field>
    {perFeedPrice && (
      <Text fontSize="xs" color="fg.muted" mt={1}>
        {perFeedPrice} per feed / {interval}
      </Text>
    )}
  </Box>
);

interface PendingChange {
  prices: Array<{ priceId: string; quantity: number }>;
  description: string;
  // The recurring charge the owner is authorizing, surfaced alongside the
  // prorated amount due today so the screen never implies the change is free.
  recurringPriceFormatted?: string;
  // Before -> after framing for a tier switch. Absent for an add-on-quantity
  // change, which keeps its plain description instead.
  tierChange?: { fromLabel: string; toLabel: string };
}

// Confirmation dialog for plan/quantity changes on an existing workspace
// subscription: fetches the prorated preview, then applies the change. The
// dialog hosts no Paddle checkout, so the modal/overlay inert interaction does
// not apply here.
// One labelled row in the "Due today" breakdown. Rendered as a description
// term/detail pair so the amounts read as a real itemized list to assistive
// tech, not visually-aligned prose.
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

const ChangeWorkspacePlanDialog = ({
  workspaceSlug,
  pendingChange,
  interval,
  nextBillDate,
  onClose,
}: {
  workspaceSlug: string;
  pendingChange: PendingChange | null;
  interval: BillingInterval;
  nextBillDate: string | null;
  onClose: () => void;
}) => {
  const { preview, status, error } = useWorkspaceBillingChangePreview({
    workspaceSlug,
    prices: pendingChange?.prices,
    enabled: !!pendingChange,
  });
  const updateMutation = useUpdateWorkspaceBilling();

  const onConfirm = async () => {
    if (!pendingChange) {
      return;
    }

    await updateMutation.mutateAsync({
      workspaceSlug,
      prices: pendingChange.prices,
    });
    onClose();
  };

  const immediate = preview?.immediateTransaction;
  const willBeDisabledCount = preview?.feedImpact?.willBeDisabledCount ?? 0;
  const newFeedLimit = preview?.feedImpact?.newFeedLimit;

  return (
    <DialogRoot open={!!pendingChange} onOpenChange={(e) => !e.open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm plan change</DialogTitle>
        </DialogHeader>
        <DialogCloseTrigger />
        <DialogBody>
          <Stack gap={5}>
            {pendingChange?.tierChange ? (
              <Text fontWeight="medium">
                {pendingChange.tierChange.fromLabel}{" "}
                <Text as="span" color="fg.muted" aria-label="changes to">
                  &rarr;
                </Text>{" "}
                {pendingChange.tierChange.toLabel}
              </Text>
            ) : (
              <Text fontWeight="medium">{pendingChange?.description}</Text>
            )}
            {pendingChange?.recurringPriceFormatted && (
              <Text fontSize="lg" fontWeight="bold">
                {pendingChange.recurringPriceFormatted}{" "}
                <Text as="span" fontSize="sm" fontWeight="normal" color="fg.muted">
                  / {interval}
                </Text>
              </Text>
            )}
            {status === "loading" && <Spinner />}
            {error && (
              <InlineErrorAlert title="Failed to load change preview" description={error.message} />
            )}
            {willBeDisabledCount > 0 && (
              <Text color="text.warning" fontSize="sm">
                {willBeDisabledCount} feed{willBeDisabledCount === 1 ? "" : "s"} over the new{" "}
                {newFeedLimit}-feed limit will be disabled (not deleted). Re-subscribe to a higher
                tier to re-enable them.
              </Text>
            )}
            {immediate && (
              <Stack gap={3}>
                <Stack gap={1}>
                  <Text fontWeight="medium" fontSize="sm">
                    Due today
                  </Text>
                  <Stack as="dl" gap={1}>
                    <AmountRow label="Subtotal" value={immediate.subtotalFormatted} />
                    <AmountRow label="Tax" value={immediate.taxFormatted} />
                    {/* Credit reduces the amount due, so it must read as a
                        deduction (signed, success-colored) rather than another
                        charge. Hidden when zero to avoid a noisy "-$0" row. */}
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
                {pendingChange?.recurringPriceFormatted && (
                  <Stack gap={1}>
                    <Text fontWeight="medium" fontSize="sm">
                      Then
                    </Text>
                    <Text fontSize="sm">
                      {pendingChange.recurringPriceFormatted} / {interval}
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
            {updateMutation.error && (
              <InlineErrorAlert
                title="Failed to change plan"
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
            disabled={!preview}
          >
            Confirm change
          </PrimaryActionButton>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
};

// Pending activation must survive a navigate-away-and-back while the webhook
// is in flight: payment already succeeded, so the page must not fall back to
// the "activate this team" pitch. Session-scoped, keyed per workspace.
const pendingActivationKey = (workspaceId: string) => `workspacePendingActivation:${workspaceId}`;

// Entry point for moving the owner's personal subscription into this team. Only
// rendered for an unsubscribed team; the parent gates it further on the
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
        Your personal plan can&apos;t fund a team. Buy a team plan directly using one of the options
        below.
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
          Move it to this team and bring your feeds, instead of paying for two plans.
        </Text>
      </Stack>
      <Button variant="outline" onClick={onStartConvert} flexShrink={0}>
        Move my plan to this team
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
// The dialog is titled so it announces itself to screen readers on open, which
// is why no separate live-region announcement is needed.
const WorkspaceCheckoutDialog = ({
  intent,
  onCancel,
  onCompleted,
}: {
  intent: WorkspaceCheckoutIntent | null;
  onCancel: () => void;
  onCompleted: () => void;
}) => {
  const { openCheckout, updatePaymentMethod, resetCheckoutData } = usePaddleContext();
  const [frameEl, setFrameEl] = useState<HTMLDivElement | null>(null);

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
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{intent?.title}</DialogTitle>
        </DialogHeader>
        <DialogCloseTrigger />
        <DialogBody>
          <Stack gap={3}>
            <DialogDescription>Payment is handled securely by Paddle.</DialogDescription>
            {/* Paddle paints its checkout onto this container; the white surface
                matches the third-party checkout surface used by the personal
                checkout flow. */}
            <Box
              className={CHECKOUT_FRAME_CLASS}
              ref={setFrameEl}
              bg="white"
              minH="634px"
              w="100%"
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
      description="Replace the card on file for this team's subscription. A secure Paddle checkout opens to enter the new card; details are not stored here."
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

export const WorkspaceBilling = () => {
  const { isConfigured, isLoaded, getPricePreview, getChargePreview } = usePaddleContext();
  const currentWorkspace = useCurrentWorkspace();
  const { workspace, refetch } = useWorkspace({
    workspaceSlug: currentWorkspace?.slug,
  });

  const cancelMutation = useCancelWorkspaceBilling();
  const resumeMutation = useResumeWorkspaceBilling();

  const [products, setProducts] = useState<PricePreview[]>();
  const [pricesError, setPricesError] = useState(false);
  const [interval, setInterval] = useState<BillingInterval>("month");
  const [pendingChange, setPendingChange] = useState<PendingChange | null>(null);
  const [awaitingActivation, setAwaitingActivation] = useState(
    () =>
      !!currentWorkspace &&
      window.sessionStorage.getItem(pendingActivationKey(currentWorkspace.id)) !== null,
  );
  const [additionalFeedsInput, setAdditionalFeedsInput] = useState<number | null>(null);
  // Add-on count chosen on the Tier 3 card during first-time activation, before
  // any subscription exists. Folded into the checkout so "Tier 3 + N feeds" is a
  // single purchase.
  const [activationAddonFeeds, setActivationAddonFeeds] = useState(0);
  const [isConvertOpen, setIsConvertOpen] = useState(false);
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
  // A single persistent polite live region. The visible UI change on success is
  // silent to screen readers, so we announce the outcome explicitly in two
  // stages: payment captured (dialog closes), then provisioning complete (the
  // webhook activates the workspace). Driving one stable region by its text
  // makes each announcement deterministic, rather than relying on blocks
  // mounting/unmounting (which announced unpredictably and over-spoke).
  const [billingAnnouncement, setBillingAnnouncement] = useState("");
  // The page heading is always rendered, so it is a stable focus target across
  // the confirming -> active transition. The transient "Confirming" status
  // region unmounts when the subscription lands, so focus must not live there.
  const headingRef = useRef<HTMLHeadingElement | null>(null);

  const isOwner = currentWorkspace?.myRole === "owner";
  const subscription = workspace?.subscription ?? null;
  const conversion = workspace?.conversion ?? null;
  const workspaceSlug = currentWorkspace?.slug ?? "";

  // Tier prices power both the activation cards and the change-plan section.
  useEffect(() => {
    if (!isConfigured || !isLoaded || !isOwner) {
      return;
    }

    getPricePreview([
      ...WORKSPACE_TIERS.flatMap((tier) => [
        { priceId: PRICE_IDS[tier].month, quantity: 1 },
        { priceId: PRICE_IDS[tier].year, quantity: 1 },
      ]),
      // The per-feed add-on price, surfaced on the Tier 3 card's extra-feed
      // control.
      { priceId: PRICE_IDS[ProductKey.Tier3Feed].month, quantity: 1 },
      { priceId: PRICE_IDS[ProductKey.Tier3Feed].year, quantity: 1 },
    ])
      .then(setProducts)
      .catch(() => setPricesError(true));
  }, [isConfigured, isLoaded, isOwner]);

  // After checkout completes, the webhook activates the workspace; poll the
  // workspace read until the subscription shows up.
  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;
  useEffect(() => {
    if (!awaitingActivation || subscription) {
      // Stage two of the announcement: the subscription landing while we were
      // awaiting activation is the genuine provisioning-complete transition.
      if (awaitingActivation && subscription) {
        setBillingAnnouncement(
          `Your ${PRODUCT_NAMES[subscription.productKey as ProductKey] ?? "subscription"} is now active.`,
        );
      }

      if (subscription) {
        setAwaitingActivation(false);

        if (currentWorkspace) {
          window.sessionStorage.removeItem(pendingActivationKey(currentWorkspace.id));
        }
      }

      return undefined;
    }

    const intervalId = window.setInterval(() => {
      refetchRef.current();
    }, 1500);

    return () => window.clearInterval(intervalId);
  }, [awaitingActivation, !!subscription]);

  if (!isConfigured || !currentWorkspace) {
    return null;
  }

  const getTierPrice = (tier: WorkspaceTier, useInterval: BillingInterval) =>
    products?.find((p) => p.id === tier)?.prices.find((p) => p.interval === useInterval)
      ?.formattedPrice;

  const getAddonPerFeedPrice = (useInterval: BillingInterval) =>
    products
      ?.find((p) => p.id === ProductKey.Tier3Feed)
      ?.prices.find((p) => p.interval === useInterval)?.formattedPrice;

  const subscribe = (tier: WorkspaceTier, addonFeeds = 0) => {
    // Remember the button that opened the dialog so focus can return to it on
    // cancel.
    checkoutOpenerRef.current = document.activeElement as HTMLElement | null;

    setCheckoutIntent({
      kind: "subscribe",
      prices: [
        { priceId: PRICE_IDS[tier][interval], quantity: 1 },
        ...(tier === ProductKey.Tier3 && addonFeeds > 0
          ? [{ priceId: PRICE_IDS[ProductKey.Tier3Feed][interval], quantity: addonFeeds }]
          : []),
      ],
      workspaceId: currentWorkspace.id,
      title: `Subscribe to ${PRODUCT_NAMES[tier]}`,
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
    window.sessionStorage.setItem(pendingActivationKey(currentWorkspace.id), "1");
    setAwaitingActivation(true);
    setBillingAnnouncement("Payment successful. Confirming your subscription…");
    setCheckoutIntent(null);
    window.setTimeout(() => headingRef.current?.focus?.(), 0);
  };

  const subscriptionInterval = (subscription?.billingInterval ?? "month") as BillingInterval;
  const currentTier = subscription?.productKey as WorkspaceTier | undefined;
  const currentAddonQuantity =
    subscription?.addons?.find((a) => a.key === ProductKey.Tier3Feed)?.quantity ?? 0;

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
                Team settings
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
          {currentWorkspace.name}&apos;s subscription pays for its feeds; it is separate from any
          member&apos;s personal plan.
        </Text>
      </Stack>
      {/* Outcome announcements (payment captured, then activation complete) go
          through one persistent polite live region so each is announced once
          and the text is fully under our control. The visible spinner below is
          decorative; it no longer carries its own live role. */}
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
            description="The team's active subscription and its renewal schedule."
          >
            {/* Plan name, capacity, and renewal status are one block of plan
                facts, so they sit tight together; the section's larger gap is
                reserved for separating this block from the actions below. */}
            <Stack gap={1}>
              <HStack gap={3}>
                <Text fontWeight="bold">
                  {PRODUCT_NAMES[subscription.productKey as ProductKey] ?? subscription.productKey}
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
            </Stack>
            {!isOwner && <Text>Only the team owner can manage billing.</Text>}
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
              title="Change plan"
              description="Compare tiers and switch this team to a different one. Tier 3 can be extended with additional feeds. You will see the prorated cost before confirming."
            >
              <SimpleGrid columns={{ base: 1, md: 2 }} gap={4} maxW="40rem" role="list">
                {WORKSPACE_TIERS.map((tier) => {
                  const isCurrent = tier === currentTier;
                  const supportsAddons = tierSupportsAddons(tier);
                  // The stepper lives on whichever card is Tier 3. When it is the
                  // current plan, it defaults to the live add-on count so the
                  // owner edits from where they are; when it is the switch
                  // target, it starts at 0. Only one Tier 3 card exists, so a
                  // single piece of state serves both.
                  const stepperValue =
                    additionalFeedsInput ?? (isCurrent ? currentAddonQuantity : 0);
                  const addonFeeds = supportsAddons ? stepperValue : 0;
                  const totalFeeds = TIER_FEED_LIMITS[tier] + addonFeeds;
                  const addonChanged = isCurrent && addonFeeds !== currentAddonQuantity;

                  const applyChange = () =>
                    setPendingChange({
                      prices: [
                        { priceId: PRICE_IDS[tier][subscriptionInterval], quantity: 1 },
                        ...(addonFeeds > 0
                          ? [
                              {
                                priceId: PRICE_IDS[ProductKey.Tier3Feed][subscriptionInterval],
                                quantity: addonFeeds,
                              },
                            ]
                          : []),
                      ],
                      description: `Switch this team to ${PRODUCT_NAMES[tier]} (${totalFeeds} feeds).`,
                      recurringPriceFormatted: getTierPrice(tier, subscriptionInterval),
                      tierChange: currentTier
                        ? {
                            fromLabel: `${PRODUCT_NAMES[currentTier]} (${
                              TIER_FEED_LIMITS[currentTier] + currentAddonQuantity
                            } feeds)`,
                            toLabel: `${PRODUCT_NAMES[tier]} (${totalFeeds} feeds)`,
                          }
                        : undefined,
                    });

                  return (
                    <TierCard
                      key={tier}
                      tier={tier}
                      price={getTierPrice(tier, subscriptionInterval)}
                      interval={subscriptionInterval}
                      current={isCurrent}
                      addonFeeds={addonFeeds}
                      getChargePreview={getChargePreview}
                      addonSlot={
                        supportsAddons ? (
                          <AdditionalFeedsControl
                            value={stepperValue}
                            onChange={setAdditionalFeedsInput}
                            perFeedPrice={getAddonPerFeedPrice(subscriptionInterval)}
                            interval={subscriptionInterval}
                          />
                        ) : undefined
                      }
                      footer={
                        // eslint-disable-next-line no-nested-ternary
                        isCurrent ? (
                          supportsAddons ? (
                            <Button
                              variant="outline"
                              disabled={!addonChanged}
                              onClick={applyChange}
                            >
                              Update additional feeds
                            </Button>
                          ) : (
                            <Text fontSize="sm" color="fg.muted">
                              This is your team&apos;s current plan.
                            </Text>
                          )
                        ) : (
                          <Button
                            variant="outline"
                            onClick={applyChange}
                            aria-label={`Switch to ${PRODUCT_NAMES[tier]}, ${totalFeeds} feeds total`}
                          >
                            Switch to {PRODUCT_NAMES[tier]}
                          </Button>
                        )
                      }
                    />
                  );
                })}
              </SimpleGrid>
            </SettingsSection>
          )}
          {isOwner && !subscription.cancellationDate && (
            <SettingsSection
              title="Cancel subscription"
              description="Stops the team's subscription at the end of the current billing period."
            >
              <Box>
                <ConfirmModal
                  title="Cancel team subscription?"
                  description="The subscription stays active until the end of the paid period. After that, the team's feeds are disabled (not deleted) until you resubscribe."
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
          title="Activate this team"
          description={
            isOwner
              ? "Subscribe to enable feeds for this team. Members and settings keep working either way."
              : undefined
          }
        >
          {!isOwner ? (
            <Text>
              This team doesn&apos;t have an active subscription. Only the team owner can manage
              billing.
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
              <SimpleGrid columns={{ base: 1, md: 2 }} gap={4} maxW="40rem" role="list">
                {WORKSPACE_TIERS.map((tier) => {
                  const supportsAddons = tierSupportsAddons(tier);
                  const addonFeeds = supportsAddons ? activationAddonFeeds : 0;
                  const totalFeeds = TIER_FEED_LIMITS[tier] + addonFeeds;

                  return (
                    <TierCard
                      key={tier}
                      tier={tier}
                      price={getTierPrice(tier, interval)}
                      interval={interval}
                      recommended={tier === ProductKey.Tier2}
                      addonFeeds={addonFeeds}
                      getChargePreview={getChargePreview}
                      addonSlot={
                        supportsAddons ? (
                          <AdditionalFeedsControl
                            value={activationAddonFeeds}
                            onChange={setActivationAddonFeeds}
                            perFeedPrice={getAddonPerFeedPrice(interval)}
                            interval={interval}
                          />
                        ) : undefined
                      }
                      footer={
                        <PrimaryActionButton
                          onClick={() => subscribe(tier, addonFeeds)}
                          aria-haspopup="dialog"
                          aria-label={`Subscribe to ${PRODUCT_NAMES[tier]}, ${totalFeeds} feeds total`}
                        >
                          Subscribe to {PRODUCT_NAMES[tier]}
                        </PrimaryActionButton>
                      }
                    />
                  );
                })}
              </SimpleGrid>
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
      <ChangeWorkspacePlanDialog
        workspaceSlug={workspaceSlug}
        pendingChange={pendingChange}
        interval={subscriptionInterval}
        nextBillDate={subscription?.nextBillDate ?? null}
        onClose={() => {
          setPendingChange(null);
          // Drop the local stepper edit so the current-plan card re-reads the
          // freshly refetched add-on count instead of a stale typed value.
          setAdditionalFeedsInput(null);
        }}
      />
      {conversion?.eligible && (
        <ConvertPersonalPlanDialog
          open={isConvertOpen}
          onClose={() => setIsConvertOpen(false)}
          onConverted={() => {
            // The subscription re-homes onto the workspace by webhook (the
            // endpoint polls for it), so show the same "confirming" state as a
            // fresh activation while the workspace read catches up.
            window.sessionStorage.setItem(pendingActivationKey(currentWorkspace.id), "1");
            setBillingAnnouncement("Confirming your subscription…");
            setAwaitingActivation(true);
          }}
          workspaceSlug={workspaceSlug}
          feedLimit={conversion.feedLimit ?? 0}
        />
      )}
    </Stack>
  );
};
