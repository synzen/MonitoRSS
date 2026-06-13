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
} from "@chakra-ui/react";
import dayjs from "dayjs";
import { captureException } from "@sentry/react";
import { FaCheck, FaChevronRight } from "react-icons/fa6";
import { Link as RouterLink } from "react-router-dom";
import { ConfirmModal } from "@/components/ConfirmModal";
import { DestructiveActionButton } from "@/components/DestructiveActionButton";
import { Checkbox } from "@/components/ui/checkbox";
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
  useConvertWorkspaceBilling,
  useWorkspaceBillingChangePreview,
  useWorkspaceUpdatePaymentMethodTransaction,
} from "../../hooks";
import { usePersonalConvertibleFeeds } from "../../hooks/usePersonalConvertibleFeeds";
import { useExpandableTierTotal } from "./useExpandableTierTotal";

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
        count, but the stepper announces neither on its own. Make the pair one
        polite live region so the settled summary ("$35.00 / month, 170 feeds")
        is read once. aria-busy holds the announcement until the debounced price
        resolves, so the instant feed-count change does not announce ahead of
        the price or spam intermediate amounts. The spinner is decorative.
      */}
      <Box aria-live="polite" aria-busy={isUpdating}>
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

// The selective feed-move dialog. Lists the owner's personal feeds (all
// selected by default — the safe move that disables nothing), shows a live
// "Selected N / M slots" counter against the moving plan's limit, marks
// deselected feeds as ones that will be disabled, and confirms by typing the
// team slug.
const ConvertPersonalPlanDialog = ({
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
  const {
    feeds,
    status,
    error: feedsError,
  } = usePersonalConvertibleFeeds({
    enabled: open,
  });
  const convertMutation = useConvertWorkspaceBilling();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [initialized, setInitialized] = useState(false);

  // Default to bringing everything once the feeds load (nothing left behind,
  // nothing disabled).
  useEffect(() => {
    if (open && status === "success" && !initialized) {
      setSelectedIds(new Set(feeds.map((f) => f.id)));
      setInitialized(true);
    }

    if (!open && initialized) {
      setInitialized(false);
    }
  }, [open, status, initialized, feeds]);

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  };

  const bringAll = () => setSelectedIds(new Set(feeds.map((f) => f.id)));

  const selectedCount = selectedIds.size;
  const overCapacity = selectedCount > feedLimit;
  const leftBehindCount = feeds.length - selectedCount;

  const onConfirm = async () => {
    await convertMutation.mutateAsync({
      workspaceSlug,
      feedIds: [...selectedIds],
    });
    onConverted();
    onClose();
  };

  return (
    <ConfirmModal
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title="Move your personal plan to this team"
      okText="Move plan"
      confirmationPhrase={workspaceSlug}
      okDisabled={overCapacity}
      error={
        convertMutation.error?.message ??
        (overCapacity
          ? `You can move at most ${feedLimit} feeds. Deselect ${selectedCount - feedLimit} to continue.`
          : undefined)
      }
      onConfirm={onConfirm}
      descriptionNode={
        <Stack gap={4}>
          <Text>
            Your personal plan becomes {workspaceSlug}&apos;s plan, and the feeds you select move
            with it. You will no longer have a personal plan. This is not easily reversible.
          </Text>
          <HStack justifyContent="space-between">
            <Text fontWeight="medium">{`Selected ${selectedCount} / ${feedLimit} team slots`}</Text>
            <Button size="xs" variant="outline" onClick={bringAll} disabled={status !== "success"}>
              Bring all
            </Button>
          </HStack>
          {leftBehindCount > 0 && (
            <Text fontSize="sm" color="text.warning">
              {leftBehindCount} feed{leftBehindCount === 1 ? "" : "s"} left behind will be disabled
              (over the free limit).
            </Text>
          )}
          {status === "loading" && <Spinner size="sm" />}
          {status === "error" && (
            <InlineErrorAlert title="Could not load your feeds" description={feedsError?.message} />
          )}
          <Stack as="ul" listStyleType="none" gap={2} maxH="20rem" overflowY="auto">
            {feeds.map((feed) => {
              const isSelected = selectedIds.has(feed.id);

              return (
                <HStack as="li" key={feed.id} justifyContent="space-between" gap={3}>
                  <Checkbox checked={isSelected} onCheckedChange={() => toggle(feed.id)}>
                    {feed.title}
                  </Checkbox>
                  {!isSelected && (
                    <Text fontSize="xs" color="text.warning" flexShrink={0}>
                      Will be disabled
                    </Text>
                  )}
                </HStack>
              );
            })}
          </Stack>
        </Stack>
      }
    />
  );
};

// Replaces the card on the team's existing subscription. The Paddle overlay is
// opened straight from this page-level button (never from inside a Chakra
// dialog, which would inert the overlay). Updating the card flips no
// subscription field, so completion is silent: Paddle's own overlay shows
// success and closes, leaving the page intact.
const WorkspacePaymentMethodSection = ({ workspaceSlug }: { workspaceSlug: string }) => {
  const { updatePaymentMethod } = usePaddleContext();
  const { error, fetchStatus, refetch } = useWorkspaceUpdatePaymentMethodTransaction(workspaceSlug);

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

      updatePaymentMethod(transactionId);
    } catch (err) {
      captureException(err);
    }
  };

  return (
    <SettingsSection
      title="Payment method"
      description="Replace the card on file for this team's subscription. Card details are entered on Paddle's secure checkout, not stored here."
    >
      <Stack gap={3} alignItems="flex-start">
        <SafeLoadingButton variant="outline" loading={fetchStatus === "fetching"} onClick={onClick}>
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
  const { isConfigured, isLoaded, openCheckout, getPricePreview, getChargePreview } =
    usePaddleContext();
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

  // After overlay checkout completes, the webhook activates the workspace;
  // poll the workspace read until the subscription shows up.
  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;
  useEffect(() => {
    if (!awaitingActivation || subscription) {
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
    openCheckout({
      prices: [
        { priceId: PRICE_IDS[tier][interval], quantity: 1 },
        ...(tier === ProductKey.Tier3 && addonFeeds > 0
          ? [{ priceId: PRICE_IDS[ProductKey.Tier3Feed][interval], quantity: addonFeeds }]
          : []),
      ],
      displayMode: "overlay",
      customData: { workspaceId: currentWorkspace.id },
      onCompleted: () => {
        window.sessionStorage.setItem(pendingActivationKey(currentWorkspace.id), "1");
        setAwaitingActivation(true);
      },
    });
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
        <Heading as="h1" size="lg">
          Billing
        </Heading>
        <Text color="fg.muted">
          {currentWorkspace.name}&apos;s subscription pays for its feeds; it is separate from any
          member&apos;s personal plan.
        </Text>
      </Stack>
      {awaitingActivation && !subscription && (
        <HStack>
          <Spinner size="sm" />
          <Text>Confirming your subscription…</Text>
        </HStack>
      )}
      {subscription ? (
        <Stack gap={10} separator={<StackSeparator />}>
          <SettingsSection
            title="Current plan"
            description="The team's active subscription and its renewal schedule."
          >
            <HStack gap={3}>
              <Text fontWeight="bold">
                {PRODUCT_NAMES[subscription.productKey as ProductKey] ?? subscription.productKey}
              </Text>
              <Badge colorPalette={subscription.cancellationDate ? "orange" : "green"}>
                {subscription.cancellationDate ? "Cancels soon" : subscription.status}
              </Badge>
            </HStack>
            {currentAddonQuantity > 0 && <Text>Additional feeds: {currentAddonQuantity}</Text>}
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
          {isOwner && <WorkspacePaymentMethodSection workspaceSlug={workspaceSlug} />}
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
                          aria-label={`Subscribe to ${PRODUCT_NAMES[tier]}, ${totalFeeds} feeds total`}
                        >
                          Subscribe to {PRODUCT_NAMES[tier]}
                        </PrimaryActionButton>
                      }
                    />
                  );
                })}
              </SimpleGrid>
              <Stack gap={1} maxW="40rem">
                <Text fontSize="sm" color="fg.muted">
                  Cancel anytime. Feeds stay active until the end of the paid period, and you can
                  switch tiers with prorated billing.
                </Text>
                <Text fontSize="sm" color="fg.muted">
                  By proceeding to payment, you are agreeing to our{" "}
                  <Link target="_blank" href="https://monitorss.xyz/terms" color="text.link">
                    terms and conditions
                  </Link>{" "}
                  and our{" "}
                  <Link
                    target="_blank"
                    href="https://monitorss.xyz/privacy-policy"
                    color="text.link"
                  >
                    privacy policy
                  </Link>
                  . The checkout process is handled by our reseller and Merchant of Record,
                  Paddle.com. Prices will be localized to your location.
                </Text>
              </Stack>
            </Stack>
          )}
        </SettingsSection>
      )}
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
            setAwaitingActivation(true);
          }}
          workspaceSlug={workspaceSlug}
          feedLimit={conversion.feedLimit ?? 0}
        />
      )}
    </Stack>
  );
};
