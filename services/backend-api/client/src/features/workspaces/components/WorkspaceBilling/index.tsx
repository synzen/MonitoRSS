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
import {
  useWorkspace,
  useCancelWorkspaceBilling,
  useResumeWorkspaceBilling,
  useUpdateWorkspaceBilling,
  useWorkspaceBillingChangePreview,
} from "../../hooks";

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

  const isOwner = currentWorkspace?.myRole === "owner";
  const subscription = workspace?.subscription ?? null;
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
              description="Switch this team to a different tier."
            >
              <HStack gap={3} flexWrap="wrap">
                {WORKSPACE_TIERS.map((tier) => (
                  <Button
                    key={tier}
                    variant="outline"
                    disabled={tier === currentTier}
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
                    {tier === currentTier
                      ? `${PRODUCT_NAMES[tier]} (current plan)`
                      : `Switch to ${PRODUCT_NAMES[tier]}`}
                  </Button>
                ))}
              </HStack>
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
                  trigger={
                    <Button variant="outline" colorPalette="red">
                      Cancel subscription
                    </Button>
                  }
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
                  const isRecommended = tier === ProductKey.Tier2;

                  return (
                    <Stack
                      key={tier}
                      role="listitem"
                      borderWidth="1px"
                      borderColor={isRecommended ? "brandSolid" : "border.emphasized"}
                      borderRadius="md"
                      padding={4}
                      gap={3}
                    >
                      <HStack justifyContent="space-between">
                        <Heading as="h3" size="sm">
                          {PRODUCT_NAMES[tier]}
                        </Heading>
                        {isRecommended && <Badge colorPalette="brand">Recommended</Badge>}
                      </HStack>
                      <Text fontSize="2xl" fontWeight="bold">
                        {getTierPrice(tier, interval) ?? <Spinner size="sm" />}
                        <Text as="span" fontSize="sm" fontWeight="normal" color="fg.muted">
                          {" "}
                          / {interval}
                        </Text>
                      </Text>
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
                      <PrimaryActionButton onClick={() => subscribe(tier)}>
                        Subscribe to {PRODUCT_NAMES[tier]}
                      </PrimaryActionButton>
                    </Stack>
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
        onClose={() => setPendingChange(null)}
      />
    </Stack>
  );
};
