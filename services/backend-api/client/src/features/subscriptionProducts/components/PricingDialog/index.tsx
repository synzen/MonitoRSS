import { FaUser, FaUsers } from "react-icons/fa6";
import {
  Box,
  Button,
  Card,
  Flex,
  HStack,
  Heading,
  Icon,
  Stack,
  Text,
  Spinner,
  Link,
  Badge,
} from "@chakra-ui/react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { captureException } from "@sentry/react";
import { InlineErrorAlert } from "@/components/InlineErrorAlert";
import { DestructiveActionButton } from "@/components/DestructiveActionButton";
import { PrimaryActionButton } from "@/components/PrimaryActionButton";
import { FAQ } from "@/components/FAQ";
import { ChangeSubscriptionDialog } from "../ChangeSubscriptionDialog";
import { ConvertToWorkspacePrompt } from "../ConvertToWorkspacePrompt";
import { getPlanDisplayName, pages, ProductKey } from "@/constants";
import { FREE_DAILY_ARTICLE_LIMIT, PAID_DAILY_ARTICLE_LIMIT } from "@/constants/dailyArticleLimits";
import { FREE_REFRESH_LABEL, PAID_REFRESH_LABEL } from "@/constants/refreshRates";
import { usePaddleContext } from "../../contexts/PaddleContext";
import { useUserMe } from "@/features/discordUser";
import { notifySuccess } from "@/utils/notifySuccess";
import formatCurrency from "@/utils/formatCurrency";
import { usePricingData } from "@/features/subscriptionProducts";
import { CreateWorkspaceDialog, findOwnedWorkspace, useWorkspaces } from "@/features/workspaces";
import { Switch } from "@/components/ui/switch";
import {
  DialogRoot,
  DialogContent,
  DialogBody,
  DialogFooter,
  DialogCloseTrigger,
} from "@/components/ui/dialog";
import { WorkspacePanel, FeatureRow } from "./WorkspacePanel";
import type { PricingDialogTarget } from "../../contexts/PricingDialogContext";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onOpen: () => void;
  // When opened from the personal feed-limit wall the dialog targets the
  // workspace region (scrolls it into view + focuses it) instead of the top.
  target?: PricingDialogTarget;
}

// Copy lives in named constants per client conventions (no magic strings) and so
// the naming sweep can verify no "Tier N" leaks into user-facing strings.
const REGION_FOR_YOU_LABEL = "For you";
const REGION_FOR_TEAM_LABEL = "For your team, or a bigger you";
const PERSONAL_FEED_COUNT = 35;

const PERSONAL_FEATURES: Array<{ label: string; included: boolean }> = [
  { label: `Track ${PERSONAL_FEED_COUNT} feeds`, included: true },
  {
    label: `${PAID_DAILY_ARTICLE_LIMIT.toLocaleString()} articles per day, per feed`,
    included: true,
  },
  { label: PAID_REFRESH_LABEL, included: true },
  { label: "Branded message delivery", included: true },
  { label: "Custom placeholders", included: true },
];

const SectionLabel = ({
  icon,
  color,
  children,
}: {
  icon: React.ReactNode;
  color: string;
  children: React.ReactNode;
}) => (
  <HStack color={color}>
    <Icon>{icon}</Icon>
    <Heading size="sm" textTransform="uppercase" letterSpacing="wide">
      {children}
    </Heading>
  </HStack>
);

interface ChangeSubscriptionDetails {
  prices: Array<{ priceId: string; quantity: number }>;
  productId: string;
  isDowngrade?: boolean;
}

export const PricingDialog = ({ isOpen, onClose, onOpen, target }: Props) => {
  const { resetCheckoutData, initCancellationFlow } = usePaddleContext();
  const { data: userData } = useUserMe();
  // Gate the list fetch on the dialog being open: this component is mounted
  // app-wide by the provider, so without the isOpen term the request would fire
  // on every page. Mirrors usePricingData below.
  const { workspaces } = useWorkspaces({ enabled: isOpen });
  const navigate = useNavigate();
  const [changeSubscriptionDetails, setChangeSubscriptionDetails] =
    useState<ChangeSubscriptionDetails>();
  const [isCreateWorkspaceOpen, setIsCreateWorkspaceOpen] = useState(false);
  // The capacity the user picked on the slider when they hit "Create workspace",
  // carried into the post-create redirect so the count on the CTA is honored.
  const [chosenFeedCount, setChosenFeedCount] = useState<number | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const workspaceRegionRef = useRef<HTMLDivElement>(null);
  // Remember which pricing action navigated away from the dialog (e.g. opening the
  // change-subscription dialog) so that when this dialog reopens we restore focus
  // to that button instead of dumping focus on the heading.
  const focusTargetIdRef = useRef<string | null>(null);

  // When opened from the feed-limit wall (target="workspace"), bring the
  // workspace region into view and move focus there so a keyboard/screen-reader
  // user lands on the high-capacity option, not the top of the dialog.
  useEffect(() => {
    if (!isOpen || target !== "workspace") {
      return;
    }

    const region = workspaceRegionRef.current;

    if (region) {
      region.scrollIntoView({ block: "center" });
      region.focus();
    }
  }, [isOpen, target]);

  const {
    products,
    interval,
    changeInterval,
    isLoading,
    hasError,
    userSubscription,
    billingPeriodEndsAt,
    additionalFeedPricePreview,
    getProductPrice,
    getWorkspaceFeedPricing,
  } = usePricingData({ isOpen });

  const onClosePricingModal = () => {
    resetCheckoutData();
    onClose();
  };

  const onChangeInterval = (e: { checked: boolean }) => {
    changeInterval(e.checked ? "year" : "month");
  };

  const subscriptionId = userData?.result.subscription.subscriptionId;
  const currentProductKey = userSubscription?.product.key;
  const isOnFreePlan = currentProductKey === ProductKey.Free;
  const isOnPersonalPlan = currentProductKey === ProductKey.Tier1;

  const onClickPrice = async (priceId?: string, productId?: ProductKey, isDowngrade?: boolean) => {
    if (!priceId || !productId || !userSubscription) {
      return;
    }

    focusTargetIdRef.current = `pricing-action-${productId}`;

    if (userSubscription.product.key === ProductKey.Free) {
      navigate(pages.checkout(priceId));
      onClose();

      return;
    }

    const isCancelling = productId === ProductKey.Free;

    if (isCancelling && subscriptionId) {
      onClose();

      try {
        const result = await initCancellationFlow(subscriptionId);

        if (result?.status === "retained" || result?.status === "chose_to_cancel") {
          notifySuccess("Changes saved!");

          return;
        }

        if (result?.status === "aborted") {
          onOpen();

          return;
        }

        if (!result || result.status === "error") {
          const errorDetails = result && "details" in result ? result.details : "flow not shown";
          captureException(new Error(`Paddle Retain error: ${errorDetails}`));
        }
      } catch (err) {
        captureException(err);
      }
    }

    setChangeSubscriptionDetails({
      prices: [{ priceId, quantity: 1 }],
      productId,
      isDowngrade,
    });

    if (!isCancelling || !subscriptionId) {
      onClose();
    }
  };

  const personalPrice = getProductPrice(ProductKey.Tier1);
  const personalBasePrice = personalPrice?.formattedPrice || "$0";
  const personalDisplayPrice = personalBasePrice.endsWith(".00")
    ? personalBasePrice.slice(0, -3)
    : personalBasePrice;

  // The free tier has no Paddle price to localize, so borrow the currency of a
  // fetched paid price to render a zero amount in the viewer's currency (e.g.
  // "€0", "¥0") rather than a hard-coded "$0". formatCurrency returns its raw
  // input unchanged for a currency it has no formatter for, so a bare "0" (no
  // symbol) signals that case; fall back to "$0" there, and before the preview
  // lands.
  const localizedFreeZero = personalPrice
    ? formatCurrency("0", personalPrice.currencyCode)
    : undefined;
  const freeDisplayPrice =
    localizedFreeZero && localizedFreeZero !== "0" ? localizedFreeZero : "$0";

  const onChooseWorkspace = (feedCount: number) => {
    setChosenFeedCount(feedCount);
    setIsCreateWorkspaceOpen(true);
  };

  // The create flow is the wrong door when the user already owns a workspace that
  // needs billing (never activated, or cancelled): they want to bill the one they
  // have, not spin up another. Route them to its billing page, carrying the chosen
  // capacity to seed its slider. An owner of only already-paid workspaces is
  // allowed to create another, so they keep the create CTA.
  const ownedWorkspace = findOwnedWorkspace(workspaces);
  const workspaceNeedingBilling = ownedWorkspace?.needsBilling ? ownedWorkspace : undefined;

  const onGoToOwnedWorkspace = (feedCount: number) => {
    if (!workspaceNeedingBilling) {
      return;
    }

    onClose();
    navigate(pages.workspaceBilling(workspaceNeedingBilling.slug, { feeds: feedCount }));
  };

  const changeSubscriptionDetailsWithProduct = changeSubscriptionDetails?.prices
    .map((price) => {
      if (price.priceId === "free-monthly") {
        return {
          ...price,
          productKey: ProductKey.Free,
          productName: "Free",
          formattedPrice: "0",
          interval: "month" as const,
        };
      }

      const product = products?.find((prod) =>
        prod.prices.some((thisPrice) => thisPrice.id === price.priceId),
      );
      const productPrice =
        (product?.id === ProductKey.Tier3Feed
          ? additionalFeedPricePreview?.prices.find((p) => p.id === price.priceId)
          : undefined) ?? product?.prices.find((p) => p.id === price.priceId);

      if (!product || !productPrice) return null;

      return {
        ...price,
        productKey: product.id,
        // Map to the display name (Personal/Team) at the boundary rather
        // than trusting product.name, so the change-subscription dialog can never
        // surface a raw Paddle "Tier N" even if the upstream name path regresses.
        productName: getPlanDisplayName(product.id) ?? product.name,
        formattedPrice: productPrice.formattedPrice,
        interval: productPrice.interval,
      };
    })
    .filter((p): p is NonNullable<typeof p> => !!p);

  return (
    <Box>
      <ChangeSubscriptionDialog
        isDowngrade={changeSubscriptionDetails?.isDowngrade}
        billingPeriodEndsAt={billingPeriodEndsAt}
        details={
          changeSubscriptionDetailsWithProduct?.length
            ? { prices: changeSubscriptionDetailsWithProduct }
            : undefined
        }
        onClose={(reopenPricing) => {
          setChangeSubscriptionDetails(undefined);
          if (reopenPricing) onOpen();
        }}
      />
      <CreateWorkspaceDialog
        isOpen={isCreateWorkspaceOpen}
        onClose={() => setIsCreateWorkspaceOpen(false)}
        onCreated={(slug) => {
          onClose();
          // Carry the picked capacity into billing so the new workspace's plan
          // selection starts at the count the user chose on the slider, instead
          // of dropping it on the floor.
          navigate(pages.workspaceBilling(slug, { feeds: chosenFeedCount ?? undefined }));
        }}
      />
      <DialogRoot
        onOpenChange={(e) => {
          if (!e.open) onClosePricingModal();
        }}
        open={isOpen}
        size="xl"
        motionPreset="slide-in-bottom"
        scrollBehavior="inside"
        initialFocusEl={() => {
          const targetId = focusTargetIdRef.current;
          focusTargetIdRef.current = null;

          return (targetId ? document.getElementById(targetId) : null) ?? headingRef.current;
        }}
      >
        <DialogContent
          bg="none"
          shadow="none"
          maxHeight="100vh"
          width={{ base: "100%", xl: "fit-content" }}
          maxWidth={{ base: "100vw", xl: "1200px" }}
        >
          <DialogCloseTrigger />
          <DialogBody bg="transparent" shadow="none" tabIndex={-1}>
            <Box mt={12} px={{ base: 2, md: 0 }}>
              <Stack gap={12} alignItems="center">
                <Stack justifyContent="center" textAlign="center" gap={2}>
                  <Heading as="h1" tabIndex={-1} ref={headingRef}>
                    Pricing
                  </Heading>
                  <Text color="fg" fontSize="lg" fontWeight="light">
                    Track a few feeds on your own, or open a shared workspace that scales as far as
                    you need.
                  </Text>
                </Stack>
                {isLoading && <Spinner mb={8} />}
                {hasError && (
                  <Stack mb={4}>
                    <InlineErrorAlert
                      title="Something went wrong while loading prices."
                      description="This issue has been automatically sent for diagnostics. Please try again later, refreshing the page, or contacting us at support@monitorss.xyz"
                    />
                  </Stack>
                )}
                {!hasError && products && userSubscription && (
                  <>
                    <Stack alignItems="center" gap={4}>
                      <HStack alignItems="center" gap={4}>
                        <Text fontSize="lg" fontWeight="semibold">
                          Monthly
                        </Text>
                        <Switch
                          size="lg"
                          colorPalette="green"
                          onCheckedChange={onChangeInterval}
                          checked={interval === "year"}
                          aria-label="Switch to yearly pricing"
                        />
                        <Text fontSize="lg" fontWeight="semibold">
                          Yearly
                        </Text>
                      </HStack>
                      <Badge fontSize="1rem" colorPalette="green" borderRadius="l3" px={4}>
                        Save 15% with a yearly plan!
                      </Badge>
                    </Stack>
                    {/* Slim convert offer above the regions, shown only to an
                        eligible existing workspace-tier personal subscriber.
                        Renders nothing (no surrounding gap) when ineligible. */}
                    <ConvertToWorkspacePrompt variant="banner" />
                    <Flex
                      gap={6}
                      direction={{ base: "column", lg: "row" }}
                      align="stretch"
                      width="100%"
                      maxW="1100px"
                    >
                      {/* "For you": Free + Personal, stacked, narrower. */}
                      <Stack
                        as="section"
                        aria-label={REGION_FOR_YOU_LABEL}
                        flex="1"
                        gap={3}
                        minW={0}
                      >
                        <SectionLabel icon={<FaUser />} color="fg.muted">
                          {REGION_FOR_YOU_LABEL}
                        </SectionLabel>
                        <Card.Root size="lg" flex="1">
                          <Card.Header pb={0}>
                            <Heading size="md">Free</Heading>
                          </Card.Header>
                          <Card.Body>
                            <Stack gap={6}>
                              <Text fontSize="4xl" fontWeight="bold" lineHeight="1">
                                {freeDisplayPrice}
                              </Text>
                              <Stack as="ul" listStyleType="none" gap={2}>
                                <FeatureRow included>Track up to 3 feeds</FeatureRow>
                                <FeatureRow included>
                                  {FREE_DAILY_ARTICLE_LIMIT} articles per day, per feed
                                </FeatureRow>
                                <FeatureRow included>{FREE_REFRESH_LABEL}</FeatureRow>
                                <FeatureRow included={false}>Branded message delivery</FeatureRow>
                                <FeatureRow included={false}>Custom placeholders</FeatureRow>
                              </Stack>
                              {isOnFreePlan && (
                                <Button width="100%" variant="outline" aria-disabled>
                                  Current plan
                                </Button>
                              )}
                            </Stack>
                          </Card.Body>
                        </Card.Root>
                        <Card.Root size="lg" flex="1">
                          <Card.Header pb={0}>
                            <Heading size="md">Personal</Heading>
                          </Card.Header>
                          <Card.Body>
                            <Stack gap={6}>
                              <Stack gap={1}>
                                <Text fontSize="4xl" fontWeight="bold" lineHeight="1">
                                  {isLoading ? (
                                    <Spinner colorPalette="brand" color="text.link" size="lg" />
                                  ) : (
                                    personalDisplayPrice
                                  )}
                                </Text>
                                <Text color="fg.muted">
                                  {interval === "month" ? "per month" : "per year"}
                                </Text>
                              </Stack>
                              <Stack as="ul" listStyleType="none" gap={2}>
                                {PERSONAL_FEATURES.map((f) => (
                                  <FeatureRow key={f.label} included={f.included}>
                                    {f.label}
                                  </FeatureRow>
                                ))}
                              </Stack>
                              {isOnPersonalPlan ? (
                                <Button width="100%" variant="outline" aria-disabled>
                                  Current plan
                                </Button>
                              ) : (
                                <PrimaryActionButton
                                  width="100%"
                                  onClick={() =>
                                    onClickPrice(personalPrice?.id, ProductKey.Tier1, false)
                                  }
                                >
                                  Choose Personal
                                </PrimaryActionButton>
                              )}
                            </Stack>
                          </Card.Body>
                        </Card.Root>
                      </Stack>
                      {/* "For your team, or a bigger you": Workspace, dominant. */}
                      <Stack
                        as="section"
                        ref={workspaceRegionRef}
                        tabIndex={-1}
                        outline="none"
                        aria-label={REGION_FOR_TEAM_LABEL}
                        flex="1.4"
                        gap={3}
                        minW={0}
                      >
                        <SectionLabel icon={<FaUsers />} color="text.link">
                          {REGION_FOR_TEAM_LABEL}
                        </SectionLabel>
                        <WorkspacePanel
                          interval={interval}
                          pricing={getWorkspaceFeedPricing(interval)}
                          ownsWorkspaceNeedingBilling={!!workspaceNeedingBilling}
                          // Opened from the feed-limit wall: the user came for
                          // capacity, so start the sizer expanded.
                          defaultSizerOpen={target === "workspace"}
                          onCreateWorkspace={onChooseWorkspace}
                          onGoToWorkspace={onGoToOwnedWorkspace}
                        />
                      </Stack>
                    </Flex>
                  </>
                )}
                {userSubscription?.product.key !== ProductKey.Free && (
                  <Flex justifyContent="center">
                    <DestructiveActionButton
                      id={`pricing-action-${ProductKey.Free}`}
                      onClick={() => onClickPrice("free-monthly", ProductKey.Free, true)}
                    >
                      <span>Cancel Subscription</span>
                    </DestructiveActionButton>
                  </Flex>
                )}
              </Stack>
              {!hasError && (
                <Box mt={12}>
                  <Box textAlign="center" pb={3} fontSize="lg">
                    <Text fontSize="sm">
                      If you are having issues during checkout, try using incognito mode or a
                      different browser. If you are still having issues, please contact us at{" "}
                      <Link color="text.link" href="mailto:support@monitorss.xyz">
                        support@monitorss.xyz
                      </Link>
                      .
                    </Text>
                  </Box>
                  <Text textAlign="center" color="fg.muted">
                    By proceeding to payment, you are agreeing to our{" "}
                    <Link target="_blank" href="https://monitorss.xyz/terms" color="text.link">
                      terms and conditions
                    </Link>{" "}
                    as well as our{" "}
                    <Link
                      target="_blank"
                      color="text.link"
                      href="https://monitorss.xyz/privacy-policy"
                    >
                      privacy policy
                    </Link>
                    .<br />
                    The checkout process is handled by our reseller and Merchant of Record,
                    Paddle.com, who also handles subscription-related inquiries. Prices will be
                    localized to your location.
                  </Text>
                </Box>
              )}
              <Stack justifyContent="center" width="100%" alignItems="center">
                <Stack mt={16} gap={8} maxW={1400} width="100%">
                  <Heading size="md" as="h2" alignSelf="center">
                    Frequently Asked Questions
                  </Heading>
                  <FAQ
                    items={[
                      {
                        q: "Is a workspace overkill if it's just me?",
                        a: (
                          <Text>
                            Not at all. A workspace with a single member gives you the same feed
                            capacity as a solo plan, plus the option to invite people whenever
                            you&apos;re ready. Same feeds, same price, with no commitment to add
                            anyone.
                          </Text>
                        ),
                      },
                      {
                        q: "Do the people I invite to a workspace have to pay?",
                        a: (
                          <Text>
                            No. Only the workspace owner pays. Anyone you invite can join and
                            co-manage feeds for free, as long as they have a verified email.
                          </Text>
                        ),
                      },
                      {
                        q: "Can I switch between plans?",
                        a: (
                          <Text>
                            Yes, you can upgrade or downgrade anytime. Whatever you&apos;ve already
                            paid for the current period is pro-rated. On an upgrade it&apos;s
                            applied toward the new plan; on a downgrade it becomes account credit
                            toward future charges.
                          </Text>
                        ),
                      },
                      {
                        q: "Can I cancel my subscription at any time?",
                        a: (
                          <Text>
                            Yes, you can cancel your subscription at any time from your account
                            page. Your subscription will remain active until the end of the period
                            you have paid for, and will then expire with no further charges.
                          </Text>
                        ),
                      },
                      {
                        q: "Can I get a refund?",
                        a: (
                          <Text>
                            We may offer a refund on a case-by-case basis depending on the
                            situation. For more information, please see our{" "}
                            <Link
                              color="text.link"
                              target="_blank"
                              href="https://monitorss.xyz/terms"
                            >
                              Terms and Conditions
                            </Link>
                            . In any case, please do not hesitate to contact us if you have any
                            questions or concerns.
                          </Text>
                        ),
                      },
                      {
                        q: "What payment methods are accepted?",
                        a: (
                          <Text>
                            We accept all major credit and debit cards, PayPal, Apple Pay, and
                            Google Pay, plus local payment methods in many regions. The methods
                            available to you will appear at checkout.
                          </Text>
                        ),
                      },
                      {
                        q: "What currencies are supported?",
                        a: (
                          <Text>
                            We support a wide range of currencies, including USD, EUR, GBP, AUD,
                            CAD, JPY, and INR. Where your local currency is supported, prices are
                            shown in it automatically.
                          </Text>
                        ),
                      },
                      {
                        q: "Who/what is Paddle?",
                        a: (
                          <Text>
                            Paddle (paddle.com) is our reseller and Merchant of Record. They handle
                            the checkout and billing process. All emails related to billing will be
                            sent from Paddle.
                          </Text>
                        ),
                      },
                      {
                        q: "Does my subscription cover feeds across multiple Discord servers?",
                        a: (
                          <Text>
                            Yes. Your subscription applies to all the feeds you own, regardless of
                            which server they&apos;re in.
                          </Text>
                        ),
                      },
                      {
                        q: "If I co-manage a feed, does it use up my own feed limit?",
                        a: (
                          <Text>
                            On a personal plan, yes. A feed you co-manage counts as one of your own
                            feeds while you have access, and its benefits, like its limit and
                            refresh rate, come from its owner, not from you. In a shared workspace
                            this goes away: shared feeds belong to the workspace, so they don&apos;t
                            count against any member&apos;s personal limit.
                          </Text>
                        ),
                      },
                      {
                        q: "In a workspace, do feeds share the workspace's plan?",
                        a: (
                          <Text>
                            Yes. Every feed in a workspace draws on the workspace&apos;s plan, no
                            matter which member created it, and all of them count toward the
                            workspace&apos;s shared total. (The co-management invites above are a
                            personal-plan feature; workspaces share access through membership
                            instead.)
                          </Text>
                        ),
                      },
                      {
                        q: "What if I have more requirements?",
                        a: (
                          <Text>
                            Please contact us at{" "}
                            <Link
                              color="text.link"
                              href="mailto:support@monitorss.xyz?subject=Custom%20Plan%20Inquiry"
                            >
                              support@monitorss.xyz
                            </Link>{" "}
                            and we will be happy to discuss a custom plan.
                          </Text>
                        ),
                      },
                    ]}
                  />
                </Stack>
              </Stack>
            </Box>
          </DialogBody>
          <DialogFooter justifyContent="center" mt={6}>
            <Button onClick={onClose} width={{ base: "full", md: "lg" }} variant="outline">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </DialogRoot>
    </Box>
  );
};
