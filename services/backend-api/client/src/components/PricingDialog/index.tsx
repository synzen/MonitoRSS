/* eslint-disable no-nested-ternary */
import { CheckIcon, CloseIcon } from "@chakra-ui/icons";
import {
  Box,
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Flex,
  HStack,
  Heading,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalOverlay,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  Spinner,
  Link,
  ModalCloseButton,
  Badge,
} from "@chakra-ui/react";
import { ChangeEvent, useEffect, useRef, useState } from "react";
import { captureException } from "@sentry/react";
import { InlineErrorAlert } from "../InlineErrorAlert";
import { useUserMe } from "../../features/discordUser";
import { FAQ } from "../FAQ";
import { ChangeSubscriptionDialog } from "../ChangeSubscriptionDialog";
import { ProductKey } from "../../constants";
import { useSubscriptionProducts } from "../../features/subscriptionProducts";
import { EXTERNAL_PROPERTIES_MAX_ARTICLES } from "../../constants/externalPropertiesMaxArticles";
import CheckoutSummary from "./CheckoutSummary";
import { usePaddleContext } from "../../contexts/PaddleContext";
import { PricePreview } from "../../types/PricePreview";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onOpen: () => void;
  openWithPriceId?: string | null;
}

enum Feature {
  Feeds = "Feeds",
  ArticleLimit = "Article Limit",
  Webhooks = "Webhooks",
  CustomPlaceholders = "Custom Placeholders",
  RefreshRate = "Refresh Rate",
  ExternalProperties = "External Properties",
}

const tiers: Array<{
  name: string;
  productId: string;
  disableSubscribe?: boolean;
  priceFormatted: string;
  highlighted?: boolean;
  features: Array<{ name: string; description: string; enabled?: boolean }>;
}> = [
  {
    name: "TIER 1",
    productId: ProductKey.Tier1,
    priceFormatted: "$5",
    features: [
      {
        name: Feature.Feeds,
        description: "Track 35 news feeds",
        enabled: true,
      },
      {
        name: Feature.ArticleLimit,
        description: "Limit of 1000 articles daily",
        enabled: true,
      },
      {
        name: Feature.Webhooks,
        description: "Custom name/avatar with webhooks",
        enabled: true,
      },
      {
        name: Feature.CustomPlaceholders,
        description: "Custom placeholders",
        enabled: true,
      },
      {
        name: Feature.RefreshRate,
        description: "2 minute refresh rate",
        enabled: true,
      },
    ],
  },
  {
    name: "TIER 2",
    productId: ProductKey.Tier2,
    priceFormatted: "$10",
    highlighted: true,
    features: [
      {
        name: Feature.Feeds,
        description: "Track 70 news feeds",
        enabled: true,
      },
      {
        name: Feature.ArticleLimit,
        description: "Limit of 1000 articles daily",
        enabled: true,
      },
      {
        name: Feature.Webhooks,
        description: "Custom name/avatar with webhooks",
        enabled: true,
      },
      {
        name: Feature.CustomPlaceholders,
        description: "Custom placeholders",
        enabled: true,
      },
      {
        name: Feature.ExternalProperties,
        description: "External properties (scrape external links)*",
        enabled: true,
      },
      {
        name: Feature.RefreshRate,
        description: "2 minute refresh rate",
        enabled: true,
      },
    ],
  },
  {
    name: "TIER 3",
    productId: ProductKey.Tier3,
    priceFormatted: "$20",
    features: [
      {
        name: Feature.Feeds,
        description: "Track 140 news feeds",
        enabled: true,
      },
      {
        name: Feature.ArticleLimit,
        description: "Limit of 1000 articles daily",
        enabled: true,
      },
      {
        name: Feature.Webhooks,
        description: "Custom name/avatar with webhooks",
        enabled: true,
      },
      {
        name: Feature.CustomPlaceholders,
        description: "Custom placeholders",
        enabled: true,
      },
      {
        name: Feature.ExternalProperties,
        description: "External properties (scrape external links)*",
        enabled: true,
      },
      {
        name: Feature.RefreshRate,
        description: "2 minute refresh rate",
        enabled: true,
      },
    ],
  },
];

const getIdealPriceTextSize = (length: number) => {
  if (length < 10) {
    return "6xl";
  }

  if (length < 11) {
    return "5xl";
  }

  return "4xl";
};

const initialInterval =
  (localStorage.getItem("preferredPricingInterval") as "month" | "year") || "month";

interface ChangeSubscriptionDetails {
  priceId: string;
  productId: string;
  isDowngrade?: boolean;
}

export const PricingDialog = ({ isOpen, onClose, onOpen, openWithPriceId }: Props) => {
  const { openCheckout, updateCheckout, getPricePreview, checkoutLoadedData, resetCheckoutData } =
    usePaddleContext();
  const [pricePreviewErrored, setPricePreviewErrored] = useState(false);
  const [isLoadingPricePreview, setIsLoadingPricePreview] = useState(true);
  const [products, setProducts] = useState<Array<PricePreview>>();
  const { status: userStatus, error: userError, data: userData } = useUserMe();
  const [checkingOutPriceId, setCheckingOutPriceId] = useState<string>();
  const [interval, setInterval] = useState<"month" | "year">(initialInterval);
  const { data: subProducts, error: subProductsError } = useSubscriptionProducts();
  const [changeSubscriptionDetails, setChangeSubscriptionDetails] =
    useState<ChangeSubscriptionDetails>();
  const userBillingInterval = userData?.result.subscription.billingInterval;
  const billingPeriodEndsAt = userData?.result.subscription.billingPeriod?.end;
  const initialFocusRef = useRef<HTMLInputElement>(null);

  const onClosePricingModal = () => {
    setCheckingOutPriceId(undefined);
    resetCheckoutData();
    onClose();
  };

  const onChangeInterval = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setInterval("year");
      localStorage.setItem("preferredPricingInterval", "year");
    } else {
      setInterval("month");
      localStorage.setItem("preferredPricingInterval", "month");
    }
  };

  const onClickPrice = (priceId?: string, productId?: string, isDowngrade?: boolean) => {
    if (!priceId || !productId || !userData) {
      return;
    }

    onClose();

    if (userData.result.subscription.product.key === ProductKey.Free) {
      setCheckingOutPriceId(priceId);
      openCheckout({
        priceId,
      });
    } else {
      setChangeSubscriptionDetails({
        priceId,
        productId,
        isDowngrade,
      });
    }
  };

  useEffect(() => {
    if (
      openWithPriceId &&
      userData &&
      userData.result.subscription.product.key === ProductKey.Free
    ) {
      openCheckout({
        priceId: openWithPriceId,
      });
    }
  }, [openWithPriceId, !!userData, openCheckout]);

  useEffect(() => {
    if (!isLoadingPricePreview) {
      initialFocusRef.current?.focus();
    }
  }, [isLoadingPricePreview, initialFocusRef.current]);

  useEffect(() => {
    if (userBillingInterval) {
      setInterval(userBillingInterval);
    }
  }, [userBillingInterval]);

  useEffect(() => {
    if (!checkoutLoadedData) {
      setCheckingOutPriceId(undefined);
    }
  }, [!!checkoutLoadedData]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    async function execute() {
      if (!subProducts) {
        return;
      }

      try {
        setIsLoadingPricePreview(true);
        const pricePreview = await getPricePreview(
          subProducts.data.products.flatMap((p) =>
            p.prices.map((pr) => pr.id).filter((pr) => pr.startsWith("pri_"))
          )
        );

        setProducts(pricePreview);
      } catch (err) {
        setPricePreviewErrored(true);
        captureException(err);
      } finally {
        setIsLoadingPricePreview(false);
      }
    }

    execute();
  }, [!!subProducts, isOpen]);

  const biggestPriceLength = products
    ? Math.max(
        ...(products?.flatMap((pr) =>
          pr.prices.filter((p) => p.interval === interval).map((p) => p.formattedPrice.length)
        ) || []),
        0
      )
    : 4;

  const priceTextSize = getIdealPriceTextSize(biggestPriceLength);
  const userSubscription = userData?.result.subscription;
  const userTierIndex = tiers?.findIndex((p) => p.productId === userSubscription?.product.key);
  const failedToLoadPrices = pricePreviewErrored || subProductsError || userError;

  console.log("🚀 ~ PricingDialog ~ checkingOutPriceId:", checkingOutPriceId);

  return (
    <Box>
      <Box display={checkingOutPriceId ? "block" : "none"}>
        <CheckoutSummary
          onChangeInterval={(newInterval) => {
            const product = subProducts?.data.products.find((p) =>
              p.prices.find((pr) => pr.id === checkingOutPriceId)
            );

            if (!product) {
              return;
            }

            const price = product.prices.find((pr) => pr.interval === newInterval);

            if (!price) {
              return;
            }

            updateCheckout({
              priceId: price.id,
            });
          }}
          checkoutData={checkoutLoadedData}
          onClose={() => {
            setCheckingOutPriceId(undefined);
          }}
          onGoBack={() => {
            setCheckingOutPriceId(undefined);
            onOpen();
          }}
        />
      </Box>
      <ChangeSubscriptionDialog
        products={products}
        isDowngrade={changeSubscriptionDetails?.isDowngrade}
        billingPeriodEndsAt={billingPeriodEndsAt}
        details={
          changeSubscriptionDetails
            ? {
                priceId: changeSubscriptionDetails.priceId,
              }
            : undefined
        }
        onClose={(reopenPricing) => {
          setChangeSubscriptionDetails(undefined);

          if (reopenPricing) {
            onOpen();
          }
        }}
      />
      <Modal
        onClose={onClosePricingModal}
        isOpen={isOpen}
        isCentered
        size="6xl"
        initialFocusRef={initialFocusRef}
        motionPreset="slideInBottom"
        scrollBehavior="inside"
      >
        <ModalOverlay backdropFilter="blur(3px)" />
        <ModalContent bg="none" shadow="none" maxHeight="100vh">
          <ModalCloseButton />
          <ModalBody bg="transparent" shadow="none">
            <Box mt={12}>
              <Stack>
                <Flex alignItems="center" justifyContent="center">
                  <Stack width="100%" alignItems="center" spacing={12} justifyContent="center">
                    <Stack justifyContent="center" textAlign="center">
                      <Heading>Pricing</Heading>
                      <Text color="whiteAlpha.800" fontSize="lg" fontWeight="light">
                        MonitoRSS is able to stay open-source and free thanks to its supporters.
                        <br />
                        Add in your support in exchange for some upgrades!
                      </Text>
                    </Stack>
                    <Heading as="h2" size="md" hidden>
                      Tiers
                    </Heading>
                    {(isLoadingPricePreview || userStatus === "loading") && <Spinner mb={8} />}
                    {failedToLoadPrices && (
                      <Stack mb={4}>
                        <InlineErrorAlert
                          title="Sorry, something went wrong while loading prices"
                          description="This issue has been automatically sent for diagnostics. Please try again later, or contact us at support@monitorss.xyz"
                        />
                      </Stack>
                    )}
                    {!subProductsError && !userError && products && userSubscription && (
                      <>
                        <Stack alignItems="center" spacing={4}>
                          <HStack alignItems="center" spacing={4}>
                            <Text fontSize="lg" fontWeight="semibold">
                              Monthly
                            </Text>
                            <Switch
                              size="lg"
                              colorScheme="green"
                              onChange={onChangeInterval}
                              ref={initialFocusRef}
                              isChecked={interval === "year"}
                            />
                            <Text fontSize="lg" fontWeight="semibold">
                              Yearly
                            </Text>
                          </HStack>
                          <Badge fontSize="1rem" colorScheme="green" borderRadius="md" px={4}>
                            Save 15% with a yearly plan!
                          </Badge>
                        </Stack>
                        <Flex overflow="auto" width="100%" margin="auto">
                          <SimpleGrid
                            margin="auto"
                            // justifyContent="center"
                            gridTemplateColumns={[
                              "325px",
                              "450px",
                              "325px 325px",
                              "325px 325px",
                              "325px 325px 325px",
                              "325px 325px 325px",
                            ]}
                            spacing={4}
                          >
                            {tiers.map(
                              (
                                { name, priceFormatted, highlighted, features, productId },
                                currentTierIndex
                              ) => {
                                const associatedProduct = products?.find((p) => p.id === productId);

                                const associatedPrice = associatedProduct?.prices.find(
                                  (p) => p.interval === interval
                                );

                                const shorterProductPrice =
                                  associatedPrice?.formattedPrice.endsWith(".00") ? (
                                    <Text fontSize={priceTextSize} fontWeight="bold">
                                      {associatedPrice?.formattedPrice.slice(0, -3)}
                                    </Text>
                                  ) : (
                                    associatedPrice?.formattedPrice
                                  );

                                const isOnThisTier =
                                  userSubscription.product.key === productId &&
                                  // There is no billing period on free
                                  (userSubscription.billingInterval === interval ||
                                    !userSubscription.billingInterval);
                                const isAboveUserTier =
                                  userTierIndex < currentTierIndex ||
                                  (userSubscription.product.key === productId &&
                                    userSubscription.billingInterval !== interval &&
                                    userSubscription.billingInterval === "month");
                                const isBelowUserTier =
                                  userTierIndex > currentTierIndex ||
                                  (userSubscription.product.key === productId &&
                                    userSubscription.billingInterval !== interval &&
                                    userSubscription.billingInterval === "year");

                                return (
                                  <Card size="lg" shadow="lg" key={associatedProduct?.name}>
                                    <CardHeader pb={0}>
                                      <Stack>
                                        <HStack justifyContent="flex-start">
                                          <Heading size="md" fontWeight="semibold">
                                            {associatedProduct?.name}
                                          </Heading>
                                          {/* {highlighted && (
                                            <Tag size="sm" colorScheme="blue" fontWeight="bold">
                                              Most Popular
                                            </Tag>
                                          )} */}
                                        </HStack>
                                        {/* <Text color="whiteAlpha.600" fontSize="lg">
                                          {description}
                                        </Text> */}
                                      </Stack>
                                    </CardHeader>
                                    <CardBody pt={1}>
                                      <Stack spacing="12">
                                        <Box>
                                          <Text fontSize={priceTextSize} fontWeight="bold">
                                            {isLoadingPricePreview && (
                                              <Spinner
                                                colorScheme="blue"
                                                color="blue.300"
                                                size="lg"
                                              />
                                            )}
                                            {!isLoadingPricePreview &&
                                              (shorterProductPrice || "N/A")}
                                          </Text>
                                          <Text fontSize="lg" color="whiteAlpha.600">
                                            {interval === "month" && "per month"}
                                            {interval === "year" && "per year"}
                                          </Text>
                                        </Box>
                                        <Stack>
                                          {features.map((f) => {
                                            return (
                                              <HStack key={f.name}>
                                                {f.enabled ? (
                                                  <Flex bg="blue.500" rounded="full" p={1}>
                                                    <CheckIcon fontSize="md" width={3} height={3} />
                                                  </Flex>
                                                ) : (
                                                  // </Box>
                                                  <Flex bg="whiteAlpha.600" rounded="full" p={1.5}>
                                                    <CloseIcon width={2} height={2} fontSize="sm" />
                                                  </Flex>
                                                )}
                                                <Text fontSize="lg">{f.description}</Text>
                                              </HStack>
                                            );
                                          })}
                                        </Stack>
                                      </Stack>
                                    </CardBody>
                                    <CardFooter justifyContent="center">
                                      <Stack width="100%" spacing={0}>
                                        <Button
                                          isDisabled={isOnThisTier}
                                          width="100%"
                                          onClick={() =>
                                            onClickPrice(
                                              associatedPrice?.id,
                                              productId,
                                              isBelowUserTier
                                            )
                                          }
                                          variant={
                                            isOnThisTier
                                              ? "outline"
                                              : isAboveUserTier
                                              ? "solid"
                                              : "outline"
                                          }
                                          colorScheme={
                                            isAboveUserTier
                                              ? "blue"
                                              : isBelowUserTier
                                              ? "red"
                                              : undefined
                                          }
                                        >
                                          {isOnThisTier && "Current Plan"}
                                          {isBelowUserTier && "Downgrade"}
                                          {isAboveUserTier && "Upgrade"}
                                        </Button>
                                      </Stack>
                                    </CardFooter>
                                  </Card>
                                );
                              }
                            )}
                          </SimpleGrid>
                        </Flex>
                      </>
                    )}
                  </Stack>
                </Flex>
                {!failedToLoadPrices && (
                  <>
                    <Box textAlign="center" pb={3} fontSize="lg">
                      <Text fontSize="sm">
                        If you are having issues after clicking &quot;Upgrade&quot;, try using
                        incognito mode or a different browser. If you are still having issues,
                        please contact us at{" "}
                        <Link color="blue.300" href="mailto:support@monitorss.xyz">
                          support@monitorss.xyz
                        </Link>
                        .
                      </Text>
                    </Box>
                    <Box textAlign="center" pb={3} fontSize="lg">
                      <Text>
                        Don&apos;t see what you&apos;re looking for?{" "}
                        <Link
                          color="blue.300"
                          href="mailto:support@monitorss.xyz?subject=Custom%20Plan%20Inquiry"
                        >
                          Let&apos;s chat!
                        </Link>
                      </Text>
                    </Box>
                    
                    {/* <Text color="whiteAlpha.600" fontSize="sm">
                      * External properties are currently limited to feeds with fewer than{" "}
                      {EXTERNAL_PROPERTIES_MAX_ARTICLES} articles
                    </Text> */}
                    <Text textAlign="center" color="whiteAlpha.600">
                      * External properties are currently limited to feeds with fewer than{" "}
                      {EXTERNAL_PROPERTIES_MAX_ARTICLES} articles <br /> <br />
                      By proceeding to payment, you are agreeing to our{" "}
                      <Link target="_blank" href="https://monitorss.xyz/terms" color="blue.300">
                        terms and conditions
                      </Link>{" "}
                      as well as our{" "}
                      <Link
                        target="_blank"
                        color="blue.300"
                        href="https://monitorss.xyz/privacy-policy"
                      >
                        privacy policy
                      </Link>
                      .<br />
                      The checkout process is handled by our reseller and Merchant of Record,
                      Paddle.com, who also handles subscription-related inquiries. Prices will be
                      localized your location.
                    </Text>
                  </>
                )}
                {userSubscription?.product.key !== ProductKey.Free && (
                  <Stack
                    margin="auto"
                    justifyContent="center"
                    mt={8}
                    textAlign="center"
                    spacing={4}
                  >
                    <Flex justifyContent="center">
                      <Button
                        colorScheme="red"
                        variant="outline"
                        onClick={() => onClickPrice("free-monthly", ProductKey.Free, true)}
                      >
                        <span>Cancel Subscription</span>
                      </Button>
                    </Flex>
                  </Stack>
                )}
              </Stack>
              <Stack justifyContent="center" width="100%" alignItems="center">
                <Stack mt={16} spacing={8} maxW={1400} width="100%">
                  <Heading size="md" as="h2" alignSelf="center">
                    Frequently Asked Questions
                  </Heading>
                  <FAQ
                    items={[
                      {
                        q: "Can I switch between plans?",
                        a: (
                          <Text>
                            Yes! You can easily upgrade or downgrade your plan, at any time. If you
                            upgrade, the amount you have already paid for the current period will be
                            pro-rated and applied to the new plan. If you downgrade, the amount you
                            have already paid for the current period will be pro-rated and applied
                            as a credit to the new plan.
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
                        q: "What payment methods are accepted?",
                        a: (
                          <Text>
                            Cards (Mastercard, Visa, Maestro, American Express, Discover, Diners
                            Club, JCB, UnionPay, and Mada), PayPal, Google Pay (only on Google
                            Chrome), and Apple Pay (only on Safari).
                          </Text>
                        ),
                      },
                      {
                        q: "What currencies are supported?",
                        a: (
                          <Text>
                            The supported currencies are USD, EUR, GBP, ARS, AUD, BRL, CAD, CHF,
                            COP, CNY, CZK, DKK, HKD, HUF, INR, ILS, JPY, KRW, MXN, NOK, NZD, PLN.
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
                              color="blue.300"
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
                        q: "How many Discord servers does my subscription apply to?",
                        a: (
                          <Text>
                            Your subscription applies to all the feeds that you own, regardless of
                            what server it is in.
                          </Text>
                        ),
                      },
                      {
                        q: "Can I apply my benefits to someone else?",
                        a: (
                          <Text>
                            While you can&apos;t transfer or apply your benefits to someone
                            else&apos; feeds, you can share your feeds for them to co-manage it with
                            you. They will have full access to manage the feeds that you share with
                            them.
                          </Text>
                        ),
                      },
                      {
                        q: "Do my benefits applied to feeds that I co-manage but do not own?",
                        a: (
                          <Text>
                            Unfortunately, no. Your benefits only apply to feeds that you own.
                            Consider asking the feed owner to transfer ownership to you if you have
                            the desired benefits.
                          </Text>
                        ),
                      },
                      {
                        q: "What if I have more requirements?",
                        a: (
                          <Text>
                            Please contact us at{" "}
                            <Link
                              color="blue.300"
                              href="mailto:support@monitorss.xyz?subject=Custom%20Plan%20Inquiry"
                            >
                              support@monitorss.xyz
                            </Link>{" "}
                            and we will be happy to discuss a custom plan.
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
                    ]}
                  />
                </Stack>
              </Stack>
            </Box>
          </ModalBody>
          <ModalFooter justifyContent="center" mt={6}>
            <Button onClick={onClose} width="lg" variant="outline">
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
};
