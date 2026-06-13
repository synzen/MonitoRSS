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
  Input,
  Link,
  SimpleGrid,
  Spinner,
  Stack,
  StackSeparator,
  Text,
} from "@chakra-ui/react";
import dayjs from "dayjs";
import { FaCheck, FaChevronRight } from "react-icons/fa6";
import { Link as RouterLink } from "react-router-dom";
import { ConfirmModal } from "@/components/ConfirmModal";
import { DestructiveActionButton } from "@/components/DestructiveActionButton";
import { Checkbox } from "@/components/ui/checkbox";
import { InlineErrorAlert } from "@/components/InlineErrorAlert";
import { PrimaryActionButton } from "@/components/PrimaryActionButton";
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
import { pages, PRICE_IDS, PRODUCT_NAMES, ProductKey } from "@/constants";
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
} from "../../hooks";
import { usePersonalConvertibleFeeds } from "../../hooks/usePersonalConvertibleFeeds";

type BillingInterval = "month" | "year";

const WORKSPACE_TIERS = [ProductKey.Tier2, ProductKey.Tier3] as const;
type WorkspaceTier = (typeof WORKSPACE_TIERS)[number];

const TIER_FEED_LIMITS: Record<WorkspaceTier, number> = {
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
// non-interactive "current plan" state).
const TierCard = ({
  tier,
  price,
  interval,
  recommended,
  current,
  feedLimitDelta,
  footer,
}: {
  tier: WorkspaceTier;
  price: string | undefined;
  interval: BillingInterval;
  recommended?: boolean;
  current?: boolean;
  feedLimitDelta?: number;
  footer: React.ReactNode;
}) => (
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
    <Box>
      <Text fontSize="2xl" fontWeight="bold">
        {price ?? <Spinner size="sm" />}
        <Text as="span" fontSize="sm" fontWeight="normal" color="fg.muted">
          {" "}
          / {interval}
        </Text>
      </Text>
      <Text fontSize="sm" color="fg.muted">
        {TIER_FEED_LIMITS[tier]} feeds
        {feedLimitDelta ? ` (${feedLimitDelta > 0 ? "+" : ""}${feedLimitDelta})` : ""}
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
    {footer}
  </Stack>
);

interface PendingChange {
  prices: Array<{ priceId: string; quantity: number }>;
  description: string;
}

// Confirmation dialog for plan/quantity changes on an existing workspace
// subscription: fetches the prorated preview, then applies the change. The
// dialog hosts no Paddle checkout, so the modal/overlay inert interaction does
// not apply here.
const ChangeWorkspacePlanDialog = ({
  workspaceSlug,
  pendingChange,
  onClose,
}: {
  workspaceSlug: string;
  pendingChange: PendingChange | null;
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

  return (
    <DialogRoot open={!!pendingChange} onOpenChange={(e) => !e.open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm plan change</DialogTitle>
        </DialogHeader>
        <DialogCloseTrigger />
        <DialogBody>
          <Stack gap={4}>
            <Text>{pendingChange?.description}</Text>
            {status === "loading" && <Spinner />}
            {error && (
              <InlineErrorAlert title="Failed to load change preview" description={error.message} />
            )}
            {preview && (
              <Stack gap={1}>
                <Text>
                  Due today: <strong>{preview.immediateTransaction.grandTotalFormatted}</strong>{" "}
                  (includes {preview.immediateTransaction.taxFormatted} tax,{" "}
                  {preview.immediateTransaction.creditFormatted} credit)
                </Text>
                <Text color="fg.muted" fontSize="sm">
                  Prorated for the current billing period.
                </Text>
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

export const WorkspaceBilling = () => {
  const { isConfigured, isLoaded, openCheckout, getPricePreview } = usePaddleContext();
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

    getPricePreview(
      WORKSPACE_TIERS.flatMap((tier) => [
        { priceId: PRICE_IDS[tier].month, quantity: 1 },
        { priceId: PRICE_IDS[tier].year, quantity: 1 },
      ]),
    )
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

  const subscribe = (tier: WorkspaceTier) => {
    openCheckout({
      prices: [{ priceId: PRICE_IDS[tier][interval], quantity: 1 }],
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
          {isOwner && !subscription.cancellationDate && (
            <SettingsSection
              title="Change plan"
              description="Compare tiers and switch this team to a different one. You will see the prorated cost before confirming."
            >
              <SimpleGrid columns={{ base: 1, md: 2 }} gap={4} maxW="40rem" role="list">
                {WORKSPACE_TIERS.map((tier) => {
                  const isCurrent = tier === currentTier;
                  const feedLimitDelta = currentTier
                    ? TIER_FEED_LIMITS[tier] - TIER_FEED_LIMITS[currentTier]
                    : 0;

                  return (
                    <TierCard
                      key={tier}
                      tier={tier}
                      price={getTierPrice(tier, subscriptionInterval)}
                      interval={subscriptionInterval}
                      current={isCurrent}
                      feedLimitDelta={isCurrent ? 0 : feedLimitDelta}
                      footer={
                        isCurrent ? (
                          <Text fontSize="sm" color="fg.muted">
                            This is your team&apos;s current plan.
                          </Text>
                        ) : (
                          <Button
                            variant="outline"
                            onClick={() =>
                              setPendingChange({
                                prices: [
                                  {
                                    priceId: PRICE_IDS[tier][subscriptionInterval],
                                    quantity: 1,
                                  },
                                ],
                                description: `Switch this team to ${PRODUCT_NAMES[tier]} (${TIER_FEED_LIMITS[tier]} feeds).`,
                              })
                            }
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
          {isOwner && !subscription.cancellationDate && currentTier === ProductKey.Tier3 && (
            <SettingsSection
              title="Additional feeds"
              description="Each additional feed extends the Tier 3 limit by one."
            >
              <Stack gap={3} maxW="20rem">
                <Field label="Quantity">
                  <Input
                    type="number"
                    min={0}
                    value={additionalFeedsInput ?? currentAddonQuantity}
                    onChange={(e) =>
                      setAdditionalFeedsInput(Math.max(0, Number(e.target.value) || 0))
                    }
                  />
                </Field>
                <Box>
                  <Button
                    variant="outline"
                    disabled={
                      additionalFeedsInput === null || additionalFeedsInput === currentAddonQuantity
                    }
                    onClick={() => {
                      const quantity = additionalFeedsInput ?? 0;
                      setPendingChange({
                        prices: [
                          {
                            priceId: PRICE_IDS[ProductKey.Tier3][subscriptionInterval],
                            quantity: 1,
                          },
                          ...(quantity > 0
                            ? [
                                {
                                  priceId: PRICE_IDS[ProductKey.Tier3Feed][subscriptionInterval],
                                  quantity,
                                },
                              ]
                            : []),
                        ],
                        description: `Set additional feeds to ${quantity}.`,
                      });
                    }}
                  >
                    Update quantity
                  </Button>
                </Box>
              </Stack>
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
                {WORKSPACE_TIERS.map((tier) => (
                  <TierCard
                    key={tier}
                    tier={tier}
                    price={getTierPrice(tier, interval)}
                    interval={interval}
                    recommended={tier === ProductKey.Tier2}
                    footer={
                      <PrimaryActionButton onClick={() => subscribe(tier)}>
                        Subscribe to {PRODUCT_NAMES[tier]}
                      </PrimaryActionButton>
                    }
                  />
                ))}
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
        onClose={() => setPendingChange(null)}
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
