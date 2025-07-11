/* eslint-disable no-nested-ternary */
import { CheckIcon, CloseIcon, AddIcon, MinusIcon } from "@chakra-ui/icons";
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
  IconButton,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
  Divider,
  Skeleton,
} from "@chakra-ui/react";
import { ChangeEvent, useEffect, useState } from "react";
import { captureException } from "@sentry/react";
import { useNavigate } from "react-router-dom";
import { InlineErrorAlert } from "../InlineErrorAlert";
import { useUserMe } from "../../features/discordUser";
import { FAQ } from "../FAQ";
import { ChangeSubscriptionDialog } from "../ChangeSubscriptionDialog";
import { pages, ProductKey } from "../../constants";
import { useSubscriptionProducts } from "../../features/subscriptionProducts";
import { EXTERNAL_PROPERTIES_MAX_ARTICLES } from "../../constants/externalPropertiesMaxArticles";
import { usePaddleContext } from "../../contexts/PaddleContext";
import { PricePreview } from "../../types/PricePreview";
import { notifyInfo } from "../../utils/notifyInfo";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onOpen: () => void;
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
  productId: ProductKey;
  disableSubscribe?: boolean;
  priceFormatted: string;
  highlighted?: boolean;
  baseFeedLimit: number;
  supportsAdditionalFeeds?: boolean;
  features: Array<{ name: string; description: string; enabled?: boolean }>;
}> = [
  {
    name: "TIER 1",
    productId: ProductKey.Tier1,
    priceFormatted: "$5",
    baseFeedLimit: 35,
    supportsAdditionalFeeds: false,
    features: [
      {
        name: Feature.Feeds,
        description: "Track 35 news feeds",
        enabled: true,
      },
      {
        name: Feature.ArticleLimit,
        description: "1000 articles daily per feed",
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
    baseFeedLimit: 70,
    supportsAdditionalFeeds: false,
    features: [
      {
        name: Feature.Feeds,
        description: "Track 70 news feeds",
        enabled: true,
      },
      {
        name: Feature.ArticleLimit,
        description: "1000 articles daily per feed",
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
    baseFeedLimit: 140,
    supportsAdditionalFeeds: true,
    features: [
      {
        name: Feature.Feeds,
        description: "Track 140 news feeds",
        enabled: true,
      },
      {
        name: Feature.ArticleLimit,
        description: "1000 articles daily per feed",
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
  prices: Array<{
    priceId: string;
    quantity: number;
  }>;
  productId: string;
  isDowngrade?: boolean;
}

export const PricingDialog = ({ isOpen, onClose, onOpen }: Props) => {
  const { getPricePreview, getChargePreview, resetCheckoutData } = usePaddleContext();
  const [pricePreviewErrored, setPricePreviewErrored] = useState(false);
  const [isLoadingPricePreview, setIsLoadingPricePreview] = useState(true);
  const [products, setProducts] = useState<Array<PricePreview>>();
  const [additionalFeedPricePreview, setAdditionalFeedPricePreview] = useState<PricePreview | null>(
    null
  );
  const [chargePreview, setChargePreview] = useState<string | null>(null);
  const [additionalFeedsInput, setAdditionalFeedsInput] = useState<number>(0);
  const [loadingAdditionalFeedsChange, setLoadingAdditionalFeedsChange] = useState(false);
  const { status: userStatus, error: userError, data: userData } = useUserMe();
  const [interval, setInterval] = useState<"month" | "year">(initialInterval);
  const { data: subProducts, error: subProductsError } = useSubscriptionProducts();
  const [baseAdditionalFeedsPrice, setBaseAdditionalFeedsPrice] = useState<string | null>(null);
  const [changeSubscriptionDetails, setChangeSubscriptionDetails] =
    useState<ChangeSubscriptionDetails>();
  const navigate = useNavigate();
  const userBillingInterval = userData?.result.subscription.billingInterval;
  const billingPeriodEndsAt = userData?.result.subscription.billingPeriod?.end;
  const priceIdOfAdditionalFeeds = subProducts?.data.products
    .filter((p) => p.id === ProductKey.Tier3Feed)
    .map((p) => p.prices.find((price) => price.interval === interval)?.id)
    .filter((id): id is string => !!id)[0];

  const priceIdOfTier3 = subProducts?.data.products
    .filter((p) => p.id === ProductKey.Tier3)
    .map((p) => p.prices.find((price) => price.interval === interval)?.id)
    .filter((id): id is string => !!id)[0];

  const additionalFeedsQuantity = additionalFeedPricePreview?.prices[0].quantity;
  const userSubscriptionAdditionalFeeds = userData?.result.subscription.addons?.find(
    (a) => a.key === ProductKey.Tier3Feed
  )?.quantity;

  const onClosePricingModal = () => {
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

  const onClickPrice = (priceId?: string, productId?: ProductKey, isDowngrade?: boolean) => {
    if (!priceId || !productId || !userData) {
      return;
    }

    if (userData.result.subscription.product.key === ProductKey.Free) {
      navigate(
        pages.checkout(
          priceId,
          productId === ProductKey.Tier3 &&
            !!additionalFeedsQuantity &&
            additionalFeedsQuantity > 0 &&
            priceIdOfAdditionalFeeds
            ? {
                priceId: priceIdOfAdditionalFeeds,
                quantity: additionalFeedsQuantity,
              }
            : undefined
        )
      );
      onClose();
    } else {
      setChangeSubscriptionDetails({
        prices: [
          {
            priceId,
            quantity: 1,
          },
          ...(productId === ProductKey.Tier3 &&
          !!additionalFeedsQuantity &&
          additionalFeedsQuantity > 0 &&
          priceIdOfAdditionalFeeds
            ? [
                {
                  priceId: priceIdOfAdditionalFeeds,
                  quantity: additionalFeedsQuantity,
                },
              ]
            : []),
        ],
        productId,
        isDowngrade,
      });
      onClose();
    }
  };

  useEffect(() => {
    if (userBillingInterval) {
      setInterval(userBillingInterval);
    }
  }, [userBillingInterval]);

  // useEffect(() => {
  //   const addons = userData?.result.subscription.addons || [];

  //   const extraFeedsAddonQuantity = addons.find((a) => a.key === ProductKey.Tier3Feed)?.quantity;

  //   if (extraFeedsAddonQuantity) {
  //     setAdditionalFeeds(extraFeedsAddonQuantity);
  //   }

  //   getPricePreview([
  //     {
  //       priceId: priceIdOfAdditionalFeeds as string,
  //       quantity: additionalFeeds || 1,
  //     },
  //   ]).then((preview) => {
  //     const additionalFeedsPreview = preview.find((p) => p.id === ProductKey.Tier3Feed);

  //     if (additionalFeedsPreview) {
  //       setAdditionalFeedPricePreview(additionalFeedsPreview);
  //     }
  //   });
  // }, [userData?.result.subscription.addons?.length]);

  // useEffect(() => {
  //   if (!priceIdOfAdditionalFeeds || !priceIdOfTier3) {
  //     return;
  //   }

  //   async function getPreview() {
  //     const [preview, chargePreviewResult] = await Promise.all([
  //       getPricePreview([
  //         {
  //           priceId: priceIdOfAdditionalFeeds as string,
  //           quantity: additionalFeeds || 1,
  //         },
  //       ]),
  //       getChargePreview([
  //         {
  //           priceId: priceIdOfAdditionalFeeds as string,
  //           quantity: additionalFeeds || 1,
  //         },
  //         {
  //           priceId: priceIdOfTier3 as string,
  //           quantity: 1,
  //         },
  //       ]),
  //     ]);

  //     const additionalFeedsPreview = preview.find((p) => p.id === ProductKey.Tier3Feed);

  //     if (additionalFeedsPreview) {
  //       setAdditionalFeedPricePreview(additionalFeedsPreview);
  //     }

  //     setChargePreview(chargePreviewResult.totalFormatted);
  //   }

  //   setAdditionalFeedPricePreview(null);
  //   setChargePreview(null);
  //   getPreview();
  // }, [additionalFeeds, interval, priceIdOfAdditionalFeeds, priceIdOfTier3]);

  const onChangeAdditionalFeeds = (newQuantity: number) => {
    if (!priceIdOfAdditionalFeeds || !priceIdOfTier3) {
      return;
    }

    setLoadingAdditionalFeedsChange(true);

    async function getPreview() {
      const [preview, chargePreviewResult] = await Promise.all([
        getPricePreview([
          {
            priceId: priceIdOfAdditionalFeeds as string,
            quantity: newQuantity,
          },
        ]),
        getChargePreview([
          {
            priceId: priceIdOfAdditionalFeeds as string,
            quantity: newQuantity,
          },
          {
            priceId: priceIdOfTier3 as string,
            quantity: 1,
          },
        ]),
      ]);
      const additionalFeedsPreview = preview.find((p) => p.id === ProductKey.Tier3Feed);

      if (additionalFeedsPreview) {
        setAdditionalFeedPricePreview(additionalFeedsPreview);
      }

      setChargePreview(chargePreviewResult.totalFormatted);
      setLoadingAdditionalFeedsChange(false);
    }

    getPreview();
  };

  useEffect(() => {
    onChangeAdditionalFeeds(additionalFeedsInput);
  }, [interval]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    async function execute() {
      if (!subProducts || !userData) {
        return;
      }

      try {
        setIsLoadingPricePreview(true);

        const userAdditionalFeedsAddon = userData.result.subscription.addons?.find(
          (a) => a.key === ProductKey.Tier3Feed
        );

        if (userAdditionalFeedsAddon?.quantity) {
          setAdditionalFeedsInput(userAdditionalFeedsAddon.quantity);
        }

        // Fetch main tier prices
        const pricesToPreview = [
          ProductKey.Tier1,
          ProductKey.Tier2,
          ProductKey.Tier3,
          ProductKey.Tier3Feed,
        ];
        const [pricePreview, totalT3ChargePreview] = await Promise.all([
          getPricePreview(
            subProducts.data.products.flatMap((product) => {
              if (!pricesToPreview.includes(product.id as ProductKey)) {
                return [];
              }

              if (product.id === ProductKey.Tier3Feed && userAdditionalFeedsAddon) {
                return product.prices.map((p) => ({
                  priceId: p.id,
                  quantity: userAdditionalFeedsAddon.quantity,
                }));
              }

              return product.prices.map((price) => ({
                priceId: price.id,
                quantity: 1,
              }));
            })
          ),
          getChargePreview([
            {
              priceId: priceIdOfAdditionalFeeds as string,
              quantity: userAdditionalFeedsAddon?.quantity || 1,
            },
            {
              priceId: priceIdOfTier3 as string,
              quantity: 1,
            },
          ]),
        ]);

        setChargePreview(totalT3ChargePreview.totalFormatted);
        setProducts(pricePreview);

        const t3FeedPricePreview = pricePreview.find((p) => p.id === ProductKey.Tier3Feed);

        if (t3FeedPricePreview) {
          setAdditionalFeedPricePreview(t3FeedPricePreview);

          const basePriceFormatted = t3FeedPricePreview.prices.find(
            (p) => p.interval === "month"
          )?.formattedPrice;

          if (basePriceFormatted) {
            setBaseAdditionalFeedsPrice(basePriceFormatted);
          }
        }
      } catch (err) {
        console.error(err);
        setPricePreviewErrored(true);
        captureException(new Error(`Price preview failed to load`), {
          extra: {
            error: err,
          },
        });
      } finally {
        setIsLoadingPricePreview(false);
      }
    }

    execute();
  }, [!!subProducts, !!userData, isOpen]);

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
        prod.prices.some((thisPrice) => thisPrice.id === price.priceId)
      );

      const productPrice = product?.prices.find((p) => p.id === price.priceId);

      if (!product || !productPrice) {
        return null;
      }

      return {
        ...price,
        productKey: product.id,
        productName: product.name,
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
            ? {
                prices: changeSubscriptionDetailsWithProduct,
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
        motionPreset="slideInBottom"
        scrollBehavior="inside"
      >
        <ModalOverlay backdropFilter="blur(3px)" />
        <ModalContent bg="none" shadow="none" maxHeight="100vh">
          <ModalCloseButton />
          <ModalBody bg="transparent" shadow="none" tabIndex={-1}>
            <Box mt={12}>
              <Stack>
                <Flex alignItems="center" justifyContent="center">
                  <Stack width="100%" alignItems="center" spacing={12} justifyContent="center">
                    <Stack justifyContent="center" textAlign="center">
                      <Heading as="h1" tabIndex={-1}>
                        Pricing
                      </Heading>
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
                          title="Something went wrong while loading prices."
                          description="This issue has been automatically sent for diagnostics. Please try again later, refreshing the page, or contacting us at support@monitorss.xyz"
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
                              isChecked={interval === "year"}
                              aria-label="Switch to yearly pricing"
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
                            role="list"
                          >
                            {tiers.map(
                              (
                                {
                                  name: _name,
                                  priceFormatted: _priceFormatted,
                                  highlighted: _highlighted,
                                  features,
                                  productId,
                                  baseFeedLimit: _baseFeedLimit,
                                  supportsAdditionalFeeds,
                                },
                                currentTierIndex
                              ) => {
                                const associatedProduct = products?.find((p) => p.id === productId);

                                const associatedPrice = associatedProduct?.prices.find(
                                  (p) => p.interval === interval
                                );

                                const basePrice = associatedPrice?.formattedPrice || "$0";

                                const shorterProductPrice = basePrice.endsWith(".00") ? (
                                  <Text fontSize={priceTextSize} fontWeight="bold">
                                    {basePrice.slice(0, -3)}
                                  </Text>
                                ) : (
                                  <Text fontSize={priceTextSize} fontWeight="bold">
                                    {basePrice}
                                  </Text>
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
                                const isUpdate =
                                  isOnThisTier &&
                                  userSubscriptionAdditionalFeeds !== additionalFeedsQuantity;

                                return (
                                  <Card
                                    size="lg"
                                    shadow="lg"
                                    key={associatedProduct?.name}
                                    role="listitem"
                                  >
                                    <CardHeader pb={0}>
                                      <Stack>
                                        <HStack justifyContent="flex-start">
                                          <Heading size="md" fontWeight="semibold">
                                            {associatedProduct?.name || ""}
                                          </Heading>
                                        </HStack>
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
                                            {interval === "month" ? "per month" : "per year"}
                                          </Text>
                                        </Box>
                                        <Stack as="ul" listStyleType="none">
                                          {features.map((f) => {
                                            return (
                                              <HStack key={f.name} as="li">
                                                {f.enabled ? (
                                                  <Flex
                                                    bg="blue.500"
                                                    rounded="full"
                                                    p={1}
                                                    aria-disabled
                                                  >
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
                                        {supportsAdditionalFeeds && (
                                          <Box>
                                            <Divider my={4} />
                                            <Stack spacing={3}>
                                              <Text fontSize="md" fontWeight="semibold">
                                                Additional Feeds
                                              </Text>
                                              {!baseAdditionalFeedsPrice ? (
                                                <Skeleton height="18px" width="30px" />
                                              ) : (
                                                <Text fontSize="sm" color="whiteAlpha.700">
                                                  Add more feeds for{" "}
                                                  {baseAdditionalFeedsPrice || "-"} each per month.
                                                </Text>
                                              )}
                                              <HStack spacing={2} alignItems="center">
                                                <IconButton
                                                  aria-label="Decrease additional feeds"
                                                  icon={<MinusIcon />}
                                                  size="sm"
                                                  variant="outline"
                                                  onClick={() => {
                                                    const newQuantity = additionalFeedsInput - 1;

                                                    if (newQuantity > 0) {
                                                      onChangeAdditionalFeeds(newQuantity);
                                                      setAdditionalFeedsInput(newQuantity);
                                                    }
                                                  }}
                                                  isDisabled={!additionalFeedsQuantity}
                                                />
                                                <NumberInput
                                                  value={additionalFeedsInput}
                                                  onChange={(valueString) => {
                                                    const newQuantity = Math.max(
                                                      0,
                                                      parseInt(valueString, 10)
                                                    );
                                                    onChangeAdditionalFeeds(newQuantity);
                                                    setAdditionalFeedsInput(newQuantity);
                                                  }}
                                                  min={0}
                                                  max={1000}
                                                  width="80px"
                                                  size="sm"
                                                >
                                                  <NumberInputField textAlign="center" />
                                                  <NumberInputStepper>
                                                    <NumberIncrementStepper />
                                                    <NumberDecrementStepper />
                                                  </NumberInputStepper>
                                                </NumberInput>
                                                <IconButton
                                                  aria-label="Increase additional feeds"
                                                  icon={<AddIcon />}
                                                  size="sm"
                                                  variant="outline"
                                                  onClick={() => {
                                                    const newQuantity = additionalFeedsInput + 1;

                                                    onChangeAdditionalFeeds(newQuantity);
                                                    setAdditionalFeedsInput(newQuantity);
                                                  }}
                                                />
                                              </HStack>
                                              <Text
                                                fontSize="sm"
                                                color="blue.300"
                                                aria-live="polite"
                                                aria-busy={
                                                  loadingAdditionalFeedsChange ||
                                                  !additionalFeedPricePreview
                                                }
                                                hidden={additionalFeedsQuantity === undefined}
                                              >
                                                {loadingAdditionalFeedsChange ||
                                                !additionalFeedPricePreview ? (
                                                  <Skeleton height="22px" width="180px" />
                                                ) : (
                                                  <Text as="span">
                                                    {additionalFeedPricePreview.prices[0].quantity}{" "}
                                                    additional feeds: +
                                                    {
                                                      additionalFeedPricePreview.prices.find(
                                                        (p) => p.interval === interval
                                                      )?.formattedPrice
                                                    }
                                                    {interval === "month"
                                                      ? " per month"
                                                      : " per year"}
                                                  </Text>
                                                )}
                                              </Text>
                                            </Stack>
                                          </Box>
                                        )}
                                        {supportsAdditionalFeeds && additionalFeedsInput > 0 && (
                                          <Box
                                            aria-live="polite"
                                            aria-busy={loadingAdditionalFeedsChange}
                                          >
                                            <Divider my={4} />
                                            <Stack spacing={2}>
                                              <Text fontSize="md" fontWeight="semibold">
                                                Total
                                              </Text>
                                              {loadingAdditionalFeedsChange ? (
                                                <Skeleton height="28px" width="120px" />
                                              ) : (
                                                <Text
                                                  fontSize="lg"
                                                  fontWeight="bold"
                                                  color="blue.300"
                                                >
                                                  {chargePreview}
                                                  {interval === "month"
                                                    ? " per month"
                                                    : " per year"}
                                                </Text>
                                              )}
                                            </Stack>
                                          </Box>
                                        )}
                                      </Stack>
                                    </CardBody>
                                    <CardFooter justifyContent="center">
                                      <Stack width="100%" spacing={0}>
                                        <Button
                                          aria-disabled={isOnThisTier && !isUpdate}
                                          width="100%"
                                          onClick={() => {
                                            if (isOnThisTier && !isUpdate) {
                                              notifyInfo("You are already on this plan");

                                              return;
                                            }

                                            onClickPrice(
                                              associatedPrice?.id,
                                              productId,
                                              isBelowUserTier
                                            );
                                          }}
                                          variant={
                                            isOnThisTier || (isOnThisTier && isUpdate)
                                              ? "outline"
                                              : isAboveUserTier
                                              ? "solid"
                                              : "outline"
                                          }
                                          colorScheme={
                                            isAboveUserTier || (isOnThisTier && isUpdate)
                                              ? "blue"
                                              : isBelowUserTier
                                              ? "red"
                                              : undefined
                                          }
                                        >
                                          {isOnThisTier && !isUpdate && <span>Current Plan</span>}
                                          {isOnThisTier && isUpdate && <span>Update Plan</span>}
                                          {isBelowUserTier && (
                                            <span>Downgrade to {associatedProduct?.name}</span>
                                          )}
                                          {isAboveUserTier && (
                                            <span>Upgrade to {associatedProduct?.name}</span>
                                          )}
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
                        Need a higher tier?{" "}
                        <Link
                          color="blue.300"
                          href="mailto:support@monitorss.xyz?subject=Custom%20Plan%20Inquiry"
                        >
                          Let&apos;s chat!
                        </Link>
                      </Text>
                    </Box>
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
