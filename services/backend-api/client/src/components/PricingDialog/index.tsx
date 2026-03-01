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
import { ChangeEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { InlineErrorAlert } from "../InlineErrorAlert";
import { FAQ } from "../FAQ";
import { ChangeSubscriptionDialog } from "../ChangeSubscriptionDialog";
import { pages, ProductKey, TIER_CONFIGS } from "../../constants";
import { EXTERNAL_PROPERTIES_MAX_ARTICLES } from "../../constants/externalPropertiesMaxArticles";
import { captureException } from "@sentry/react";
import { usePaddleContext } from "../../contexts/PaddleContext";
import { useUserMe } from "../../features/discordUser";
import { notifyInfo } from "../../utils/notifyInfo";
import { notifySuccess } from "../../utils/notifySuccess";
import { usePricingData } from "../../features/subscriptionProducts";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onOpen: () => void;
}

const getIdealPriceTextSize = (length: number) => {
  if (length < 10) return "6xl";
  if (length < 11) return "5xl";

  return "4xl";
};

interface ChangeSubscriptionDetails {
  prices: Array<{ priceId: string; quantity: number }>;
  productId: string;
  isDowngrade?: boolean;
}

export const PricingDialog = ({ isOpen, onClose, onOpen }: Props) => {
  const { resetCheckoutData, initCancellationFlow } = usePaddleContext();
  const { data: userData } = useUserMe();
  const navigate = useNavigate();
  const [changeSubscriptionDetails, setChangeSubscriptionDetails] =
    useState<ChangeSubscriptionDetails>();

  const {
    products,
    interval,
    changeInterval,
    isLoading,
    isLoadingAdditionalFeedsChange,
    hasError,
    userSubscription,
    billingPeriodEndsAt,
    additionalFeedsInput,
    changeAdditionalFeedsInput,
    additionalFeedPricePreview,
    additionalFeedsQuantity,
    userSubscriptionAdditionalFeeds,
    chargePreview,
    baseAdditionalFeedsPrice,
    priceIdOfAdditionalFeeds,
    getProductPrice,
    getProduct,
  } = usePricingData({ isOpen });

  const onClosePricingModal = () => {
    resetCheckoutData();
    onClose();
  };

  const onChangeInterval = (e: ChangeEvent<HTMLInputElement>) => {
    changeInterval(e.target.checked ? "year" : "month");
  };

  const subscriptionId = userData?.result.subscription.subscriptionId;

  const onClickPrice = async (priceId?: string, productId?: ProductKey, isDowngrade?: boolean) => {
    if (!priceId || !productId || !userSubscription) {
      return;
    }

    const additionalFeedsItem =
      productId === ProductKey.Tier3 &&
      !!additionalFeedsQuantity &&
      additionalFeedsQuantity > 0 &&
      priceIdOfAdditionalFeeds
        ? { priceId: priceIdOfAdditionalFeeds, quantity: additionalFeedsQuantity }
        : undefined;

    if (userSubscription.product.key === ProductKey.Free) {
      navigate(pages.checkout(priceId, additionalFeedsItem));
      onClose();

      return;
    }

    const isCancelling = productId === ProductKey.Free;

    if (isCancelling && subscriptionId) {
      onClose();

      try {
        const result = await initCancellationFlow(subscriptionId);
        console.log("[Paddle Retain] Flow completed with status:", result.status);

        if (result.status === "retained" || result.status === "chose_to_cancel") {
          notifySuccess("Changes saved!");

          return;
        }

        if (result.status === "aborted") {
          onOpen();

          return;
        }

        if (result.status === "error") {
          const errorDetails = "details" in result ? result.details : "unknown";
          console.warn("[Paddle Retain] Flow returned error:", errorDetails);
          captureException(new Error(`Paddle Retain error: ${errorDetails}`));
        }
      } catch (err) {
        console.warn("[Paddle Retain] initCancellationFlow threw:", err);
        captureException(err);
      }
    }

    setChangeSubscriptionDetails({
      prices: [{ priceId, quantity: 1 }, ...(additionalFeedsItem ? [additionalFeedsItem] : [])],
      productId,
      isDowngrade,
    });

    if (!isCancelling || !subscriptionId) {
      onClose();
    }
  };

  const biggestPriceLength = products
    ? Math.max(
        ...products.flatMap((pr) =>
          pr.prices.filter((p) => p.interval === interval).map((p) => p.formattedPrice.length),
        ),
        0,
      )
    : 4;

  const priceTextSize = getIdealPriceTextSize(biggestPriceLength);
  const userTierIndex = TIER_CONFIGS.findIndex(
    (t) => t.productId === userSubscription?.product.key,
  );

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
      const productPrice = product?.prices.find((p) => p.id === price.priceId);

      if (!product || !productPrice) return null;

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
            ? { prices: changeSubscriptionDetailsWithProduct }
            : undefined
        }
        onClose={(reopenPricing) => {
          setChangeSubscriptionDetails(undefined);
          if (reopenPricing) onOpen();
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
                            {TIER_CONFIGS.map(
                              (
                                { productId, features, supportsAdditionalFeeds },
                                currentTierIndex,
                              ) => {
                                const product = getProduct(productId);
                                const price = getProductPrice(productId);
                                const basePrice = price?.formattedPrice || "$0";

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
                                  productId === ProductKey.Tier3 &&
                                  (userSubscriptionAdditionalFeeds ?? 0) !==
                                    additionalFeedsQuantity;

                                return (
                                  <Card size="lg" shadow="lg" key={product?.name} role="listitem">
                                    <CardHeader pb={0}>
                                      <Stack>
                                        <HStack justifyContent="flex-start">
                                          <Heading size="md" fontWeight="semibold">
                                            {product?.name || ""}
                                          </Heading>
                                        </HStack>
                                      </Stack>
                                    </CardHeader>
                                    <CardBody pt={1}>
                                      <Stack spacing="12">
                                        <Box>
                                          <Text fontSize={priceTextSize} fontWeight="bold">
                                            {isLoading && (
                                              <Spinner
                                                colorScheme="blue"
                                                color="blue.300"
                                                size="lg"
                                              />
                                            )}
                                            {!isLoading && (shorterProductPrice || "N/A")}
                                          </Text>
                                          <Text fontSize="lg" color="whiteAlpha.600">
                                            {interval === "month" ? "per month" : "per year"}
                                          </Text>
                                        </Box>
                                        <Stack as="ul" listStyleType="none">
                                          {features.map((f) => (
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
                                                <Flex bg="whiteAlpha.600" rounded="full" p={1.5}>
                                                  <CloseIcon width={2} height={2} fontSize="sm" />
                                                </Flex>
                                              )}
                                              <Text fontSize="lg">{f.description}</Text>
                                            </HStack>
                                          ))}
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
                                                  Add more feeds for {baseAdditionalFeedsPrice} each
                                                  per month.
                                                </Text>
                                              )}
                                              <HStack spacing={2} alignItems="center">
                                                <IconButton
                                                  aria-label="Decrease additional feeds"
                                                  icon={<MinusIcon />}
                                                  size="sm"
                                                  variant="outline"
                                                  onClick={() => {
                                                    if (additionalFeedsInput > 0) {
                                                      changeAdditionalFeedsInput(
                                                        additionalFeedsInput - 1,
                                                      );
                                                    }
                                                  }}
                                                  isDisabled={!additionalFeedsQuantity}
                                                />
                                                <NumberInput
                                                  value={additionalFeedsInput}
                                                  onChange={(valueString) => {
                                                    changeAdditionalFeedsInput(
                                                      parseInt(valueString, 10),
                                                    );
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
                                                    changeAdditionalFeedsInput(
                                                      additionalFeedsInput + 1,
                                                    );
                                                  }}
                                                />
                                              </HStack>
                                              <Text
                                                fontSize="sm"
                                                color="blue.300"
                                                aria-live="polite"
                                                aria-busy={
                                                  isLoadingAdditionalFeedsChange ||
                                                  !additionalFeedPricePreview
                                                }
                                                hidden={additionalFeedsQuantity === undefined}
                                              >
                                                {isLoadingAdditionalFeedsChange ||
                                                !additionalFeedPricePreview ? (
                                                  <Skeleton height="22px" width="180px" />
                                                ) : (
                                                  <Text as="span">
                                                    {additionalFeedPricePreview.prices[0].quantity}{" "}
                                                    additional feeds: +
                                                    {
                                                      additionalFeedPricePreview.prices.find(
                                                        (p) => p.interval === interval,
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
                                            aria-busy={isLoadingAdditionalFeedsChange}
                                          >
                                            <Divider my={4} />
                                            <Stack spacing={2}>
                                              <Text fontSize="md" fontWeight="semibold">
                                                Total
                                              </Text>
                                              {isLoadingAdditionalFeedsChange ? (
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

                                            onClickPrice(price?.id, productId, isBelowUserTier);
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
                                            <span>Downgrade to {product?.name}</span>
                                          )}
                                          {isAboveUserTier && (
                                            <span>Upgrade to {product?.name}</span>
                                          )}
                                        </Button>
                                      </Stack>
                                    </CardFooter>
                                  </Card>
                                );
                              },
                            )}
                          </SimpleGrid>
                        </Flex>
                      </>
                    )}
                  </Stack>
                </Flex>
                {!hasError && (
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
