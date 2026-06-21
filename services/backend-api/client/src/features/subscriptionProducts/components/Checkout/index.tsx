import {
  Badge,
  Box,
  Button,
  Separator,
  Flex,
  Heading,
  HStack,
  Icon,
  Skeleton,
  Stack,
  TableRoot,
  TableScrollArea,
  TableBody,
  TableRow,
  TableCell,
  Text,
} from "@chakra-ui/react";
import { useLocation, Link as RouterLink } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { captureException } from "@sentry/react";
import dayjs from "dayjs";
import { FaChevronLeft, FaCircleCheck } from "react-icons/fa6";
import { PrimaryActionButton } from "@/components/PrimaryActionButton";
import { Switch } from "@/components/ui/switch";
import { BoxConstrained, DashboardContentV2, Panel } from "@/components";
import {
  pages,
  ProductKey,
  PRICE_IDS,
  findProductKeyByPriceId,
  getPlanDisplayName,
} from "@/constants";
import { useUserMe } from "@/features/discordUser";
import { usePaddleContext } from "../../contexts/PaddleContext";

interface Props {
  cancelUrl: string;
}

export const Checkout = ({ cancelUrl }: Props) => {
  const location = useLocation();
  const originalPriceId = location.pathname.split("/").pop();
  const searchParams = new URLSearchParams(location.search);
  const feedsParam = searchParams.get("feeds")?.split(",");
  const feedsQuantity = feedsParam ? parseInt(feedsParam[0], 10) : 0;
  const feedsPriceId = feedsParam ? feedsParam[1] : undefined;
  const [priceId, setPriceId] = useState(originalPriceId);
  const {
    openCheckout,
    updateCheckout,
    checkoutLoadedData: checkoutData,
    isSubscriptionCreated,
  } = usePaddleContext();
  const [waitingForUpdate, setWaitingForUpdate] = useState(false);
  const checkoutRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const { status: userStatus, error: userError } = useUserMe();
  const topLevelProductCheckoutData = checkoutData?.items.find((item) => item.priceId === priceId);
  const feedsCheckoutData = checkoutData?.items.find((item) => item.priceId === feedsPriceId);
  // Show the user-facing plan name (Free / Personal / Team) instead of the
  // Paddle product name ("Tier N") that the checkout event carries.
  const topLevelProductKey = priceId ? findProductKeyByPriceId(priceId) : null;
  const topLevelProductDisplayName = topLevelProductKey
    ? getPlanDisplayName(topLevelProductKey)
    : topLevelProductCheckoutData?.productName;

  useEffect(() => {
    if (isSubscriptionCreated && headingRef.current) {
      headingRef.current.focus();
    }
  }, [isSubscriptionCreated, headingRef.current]);

  useEffect(() => {
    if (!checkoutData) {
      return;
    }

    setWaitingForUpdate(false);
  }, [topLevelProductCheckoutData?.interval]);

  useEffect(() => {
    if (!priceId || !checkoutRef.current) {
      return;
    }

    openCheckout({
      prices: [
        {
          priceId,
          quantity: 1,
        },
        ...(feedsPriceId && feedsQuantity > 0
          ? [
              {
                priceId: feedsPriceId,
                quantity: feedsQuantity,
              },
            ]
          : []),
      ],
      frameTarget: checkoutRef.current.className,
    });
  }, [priceId, openCheckout, checkoutRef.current]);

  const formatCurrency = (number?: number) => {
    const currency = checkoutData?.currencyCode;

    try {
      if (!currency) {
        return `${number}`;
      }

      const { locale } = new Intl.NumberFormat().resolvedOptions();
      const formatter = new Intl.NumberFormat(locale, {
        style: "currency",
        currency,
      });

      return formatter.format(number ?? 0);
    } catch (err) {
      captureException(err, {
        extra: {
          number,
          currency,
        },
      });

      return `${number}`;
    }
  };

  const onChangeInterval = (newInterval: "month" | "year") => {
    if (!priceId) {
      return;
    }

    const productKey = findProductKeyByPriceId(priceId);

    if (!productKey) {
      return;
    }

    const newPriceId = PRICE_IDS[productKey][newInterval];
    const priceIdOfAdditionalFeeds = PRICE_IDS[ProductKey.Tier3Feed][newInterval];

    setPriceId(newPriceId);
    updateCheckout({
      prices: [
        {
          priceId: newPriceId,
          quantity: 1,
        },
        ...(feedsQuantity > 0
          ? [
              {
                priceId: priceIdOfAdditionalFeeds,
                quantity: feedsQuantity,
              },
            ]
          : []),
      ],
    });
  };

  const isLoaded = !waitingForUpdate && !!checkoutData && userStatus === "success";
  const error = userError;

  const todayFormatted = dayjs().format("D MMM YYYY");
  const expirationFormatted = topLevelProductCheckoutData
    ? dayjs().add(1, topLevelProductCheckoutData.interval).format("D MMM YYYY")
    : todayFormatted;

  const checkoutDataExists = !!checkoutData;
  const checkoutRecurringTotalsExist = !!checkoutData?.recurringTotals;

  useEffect(() => {
    if (checkoutDataExists && !checkoutRecurringTotalsExist) {
      captureException(new Error("Recurring totals do not exist"), {
        extra: {
          checkoutData,
        },
      });
    }
  }, [checkoutRecurringTotalsExist, checkoutDataExists]);

  return (
    <DashboardContentV2 error={error} loading={false}>
      <BoxConstrained.Wrapper>
        <BoxConstrained.Container paddingTop={10} gap={6} paddingBottom={32}>
          <Stack alignItems="center">
            <Stack maxWidth="5xl" width="100%">
              <HStack
                gap={0}
                bg="bg.panel"
                borderWidth="1px"
                borderColor="border"
                rounded="l3"
                alignItems="flex-start"
                flexWrap="wrap"
                overflow="auto"
                mb={4}
                mx={8}
              >
                {isSubscriptionCreated && (
                  <Stack
                    flex={1}
                    gap={4}
                    px={8}
                    py={12}
                    textAlign="center"
                    justifyContent="center"
                    alignItems="center"
                    h="100%"
                  >
                    <Icon as={FaCircleCheck} color="text.success" boxSize={14} aria-hidden="true" />
                    <Heading ref={headingRef} fontWeight={600} fontSize="lg" as="h1" tabIndex={-1}>
                      Your benefits have been provisioned.
                    </Heading>
                    <Text>Thank you for supporting MonitoRSS!</Text>
                    <PrimaryActionButton asChild size="sm">
                      <RouterLink to={cancelUrl || pages.userFeeds()}>
                        {cancelUrl ? "Back to previous page" : "Back to Home"}
                      </RouterLink>
                    </PrimaryActionButton>
                  </Stack>
                )}
                {!isSubscriptionCreated && (
                  <Stack flex={1} gap={4} px={8} pb={8} pt={6}>
                    <Box>
                      <Button
                        asChild
                        size="sm"
                        variant="ghost"
                        aria-label={cancelUrl ? "Back to previous page" : "Back to Home"}
                      >
                        <RouterLink to={cancelUrl || pages.userFeeds()}>
                          <FaChevronLeft />
                          Back
                        </RouterLink>
                      </Button>
                    </Box>
                    <Heading fontWeight={600} fontSize="md" as="h1" tabIndex={-1}>
                      Checkout Summary
                    </Heading>
                    <Panel surface="subtle" display="flex" flexDirection="column" gap={4} p={4}>
                      {/* Product Name Header */}
                      <HStack alignItems="center">
                        <Skeleton loading={!isLoaded}>
                          <Text fontSize="xl" fontWeight="semibold">
                            {topLevelProductDisplayName} (
                            {topLevelProductCheckoutData?.interval === "year"
                              ? "Annual"
                              : "Monthly"}
                            )
                          </Text>
                        </Skeleton>
                      </HStack>
                      <Stack gap={3}>
                        {/* Base Plan Cost */}
                        <HStack justifyContent="space-between" alignItems="flex-start">
                          <Stack gap={1}>
                            <Text fontSize="md" fontWeight="medium">
                              {topLevelProductDisplayName}
                            </Text>
                          </Stack>
                          <Skeleton loading={!isLoaded}>
                            <Text fontSize="lg" fontWeight="semibold">
                              {formatCurrency(topLevelProductCheckoutData?.totals.subtotal)}
                            </Text>
                          </Skeleton>
                        </HStack>
                        {/* Additional Feeds Cost (if applicable) */}
                        {feedsCheckoutData && feedsQuantity > 0 && (
                          <HStack justifyContent="space-between" alignItems="flex-start">
                            <Stack gap={1}>
                              <Text fontSize="md" fontWeight="medium">
                                Additional Feeds ({feedsQuantity})
                              </Text>
                              <Skeleton loading={!isLoaded}>
                                <Text fontSize="sm" color="fg.muted">
                                  {formatCurrency(
                                    (feedsCheckoutData?.totals.subtotal || 0) / feedsQuantity,
                                  )}{" "}
                                  each × {feedsQuantity}
                                </Text>
                              </Skeleton>
                            </Stack>
                            <Skeleton loading={!isLoaded}>
                              <Text fontSize="lg" fontWeight="semibold">
                                {formatCurrency(feedsCheckoutData?.totals.subtotal)}
                              </Text>
                            </Skeleton>
                          </HStack>
                        )}
                      </Stack>
                      {/* Divider and Billing Toggle - Hidden when additional feeds are specified due to Paddle checkout update bug */}
                      {feedsQuantity === 0 && (
                        <>
                          <Separator />
                          <HStack py={2} bg="bg.emphasized" rounded="l3" px={3}>
                            <Switch
                              checked={topLevelProductCheckoutData?.interval === "year"}
                              colorPalette="green"
                              aria-label="Toggle annual billing for 15% savings"
                              aria-disabled={!isLoaded}
                              onCheckedChange={(e) => {
                                if (!isLoaded) {
                                  return;
                                }

                                onChangeInterval(e.checked ? "year" : "month");
                                setWaitingForUpdate(true);
                              }}
                            />
                            <Skeleton loading={!isLoaded}>
                              <Badge colorPalette="green">
                                <Text>Save 15%</Text>
                              </Badge>
                              <Text display="inline"> with annual billing</Text>
                            </Skeleton>
                          </HStack>
                        </>
                      )}
                    </Panel>
                    <TableScrollArea mt={6}>
                      <TableRoot variant="line" css={{ "& tr": { background: "transparent" } }}>
                        <TableBody>
                          <TableRow>
                            <TableCell py={2} px="0">
                              Subtotal
                            </TableCell>
                            <TableCell py={2} textAlign="end" px="0">
                              <Skeleton loading={!isLoaded}>
                                {formatCurrency(checkoutData?.totals.subtotal) || "100"}
                              </Skeleton>
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell py={2} px="0">
                              Tax
                            </TableCell>
                            <TableCell py={2} px="0" textAlign="end">
                              <Skeleton loading={!isLoaded}>
                                {formatCurrency(checkoutData?.totals.tax) || "100"}
                              </Skeleton>
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell py={2} px="0">
                              Credits
                            </TableCell>
                            <TableCell py={2} px="0" textAlign="end">
                              <Skeleton loading={!isLoaded}>
                                {formatCurrency(checkoutData?.totals.credit) || "0"}
                              </Skeleton>
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell py={2} px="0">
                              <strong>Total Due Today</strong>
                            </TableCell>
                            <TableCell py={2} px="0" textAlign="end">
                              <Skeleton loading={!isLoaded}>
                                <strong>
                                  {formatCurrency(checkoutData?.totals.balance) || "100"}
                                </strong>
                              </Skeleton>
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell pt={5} pb={2} px="0">
                              <Text fontSize="sm" color="fg.muted">
                                Next charge on{" "}
                                <Skeleton display="inline" loading={!isLoaded}>
                                  {expirationFormatted}
                                </Skeleton>
                              </Text>
                            </TableCell>
                            <TableCell pt={5} pb={2} px="0" textAlign="end">
                              <Skeleton loading={!isLoaded}>
                                <Text fontSize="sm" color="fg.muted">
                                  {/** Recurring total may not exist for cancelled subscriptions */}
                                  {checkoutData?.recurringTotals
                                    ? formatCurrency(checkoutData?.recurringTotals.total) || "100"
                                    : "Error"}
                                </Text>
                              </Skeleton>
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </TableRoot>
                    </TableScrollArea>
                  </Stack>
                )}
                <Flex
                  flex={1}
                  className="checkout-page"
                  bg="white"
                  borderTopRightRadius="md"
                  borderBottomRightRadius="md"
                  ref={checkoutRef}
                />
              </HStack>
            </Stack>
            <Text fontSize="sm" color="fg.muted" textAlign="center">
              If the checkout form does not fully load, please try refreshing the page or using a
              different browser.
            </Text>
          </Stack>
        </BoxConstrained.Container>
      </BoxConstrained.Wrapper>
    </DashboardContentV2>
  );
};
