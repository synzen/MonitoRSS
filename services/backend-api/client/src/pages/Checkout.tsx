import {
  Badge,
  Box,
  Button,
  Divider,
  Flex,
  Heading,
  HStack,
  Skeleton,
  Stack,
  Switch,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Tr,
} from "@chakra-ui/react";
import { useLocation, Link as RouterLink } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { captureException } from "@sentry/react";
import dayjs from "dayjs";
import { ChevronLeftIcon } from "@chakra-ui/icons";
import { FaCircleCheck } from "react-icons/fa6";
import { BoxConstrained, DashboardContentV2 } from "../components";
import { pages } from "../constants";
import { usePaddleContext } from "../contexts/PaddleContext";
import { useSubscriptionProducts } from "../features/subscriptionProducts";
import { useUserMe } from "../features/discordUser";
import getChakraColor from "../utils/getChakraColor";

interface Props {
  cancelUrl: string;
}

export const Checkout = ({ cancelUrl }: Props) => {
  const location = useLocation();
  const originalPriceId = location.pathname.split("/").pop();
  const [priceId] = useState(originalPriceId);
  const {
    openCheckout,
    updateCheckout,
    checkoutLoadedData: checkoutData,
    isSubscriptionCreated,
  } = usePaddleContext();
  const { data: subProducts, error: subProductsError } = useSubscriptionProducts();
  const [waitingForUpdate, setWaitingForUpdate] = useState(false);
  const checkoutRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const { status: userStatus, error: userError } = useUserMe();

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
  }, [checkoutData?.item.interval]);

  useEffect(() => {
    if (!priceId || !checkoutRef.current) {
      return;
    }

    openCheckout({
      priceId,
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
    const product = subProducts?.data.products.find((p) =>
      p.prices.find((pr) => pr.id === priceId)
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
  };

  const isLoaded = !waitingForUpdate && !!checkoutData && !!subProducts && userStatus === "success";
  const error = subProductsError || userError;

  const todayFormatted = dayjs().format("D MMM YYYY");
  const expirationFormatted = checkoutData
    ? dayjs().add(1, checkoutData.item.interval).format("D MMM YYYY")
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
        <BoxConstrained.Container paddingTop={10} spacing={6} paddingBottom={32}>
          <Stack alignItems="center">
            <Stack maxWidth="5xl" width="100%">
              <HStack
                gap={0}
                bg="gray.700"
                rounded="md"
                alignItems="flex-start"
                flexWrap="wrap"
                overflow="auto"
                mb={4}
                mx={8}
              >
                {isSubscriptionCreated && (
                  <Stack
                    flex={1}
                    spacing={4}
                    px={8}
                    py={12}
                    textAlign="center"
                    justifyContent="center"
                    alignItems="center"
                    h="100%"
                  >
                    <FaCircleCheck color={getChakraColor("green.500")} fontSize={52} />
                    <Heading ref={headingRef} fontWeight={600} fontSize="lg" as="h1" tabIndex={-1}>
                      Your benefits have been provisioned.
                    </Heading>
                    <Text>Thank you for supporting MonitoRSS!</Text>
                    <Button
                      as={RouterLink}
                      to={cancelUrl || pages.userFeeds()}
                      size="sm"
                      colorScheme="blue"
                    >
                      {cancelUrl ? "Back to previous page" : "Back to Home"}
                    </Button>
                  </Stack>
                )}
                {!isSubscriptionCreated && (
                  <Stack flex={1} spacing={4} px={8} pb={8} pt={6}>
                    <Box>
                      <Button
                        as={RouterLink}
                        to={cancelUrl || pages.userFeeds()}
                        size="sm"
                        leftIcon={<ChevronLeftIcon />}
                        variant="ghost"
                        aria-label={cancelUrl ? "Back to previous page" : "Back to Home"}
                      >
                        Back
                      </Button>
                    </Box>
                    <Heading fontWeight={600} fontSize="md" as="h1" tabIndex={-1}>
                      Checkout Summary
                    </Heading>
                    <Stack spacing={0} borderColor="gray.800" borderWidth={2} rounded="md">
                      <HStack alignItems="center" px={4} pt={4}>
                        <Skeleton isLoaded={isLoaded}>
                          <Text fontSize="xl">{checkoutData?.item.productName}</Text>
                        </Skeleton>
                      </HStack>
                      <Box px={4} pb={4}>
                        <Skeleton isLoaded={isLoaded}>
                          <Text fontSize="4xl" fontWeight="semibold" display="inline">
                            {/** Recurring total may not exist for cancelled subscriptions */}
                            {checkoutData?.recurringTotals
                              ? formatCurrency(checkoutData?.recurringTotals.total)
                              : "Error"}
                          </Text>
                          <Text display="inline"> per {checkoutData?.item.interval}</Text>
                        </Skeleton>
                      </Box>
                      <Divider />
                      <HStack px={4} py={2} bg="gray.800">
                        <Switch
                          checked={checkoutData?.item.interval === "year"}
                          colorScheme="green"
                          aria-label="Toggle annual billing for 15% savings"
                          aria-disabled={!isLoaded}
                          isChecked={checkoutData?.item.interval === "year"}
                          onChange={(e) => {
                            if (!isLoaded) {
                              return;
                            }

                            onChangeInterval(e.target.checked ? "year" : "month");
                            setWaitingForUpdate(true);
                          }}
                        />
                        <Skeleton isLoaded={isLoaded}>
                          <Badge colorScheme="green">
                            <Text>Save 15%</Text>
                          </Badge>
                          <Text display="inline"> with annual billing</Text>
                        </Skeleton>
                      </HStack>
                    </Stack>
                    <TableContainer mt={6}>
                      <Table variant="unstyled">
                        <Tbody>
                          <Tr>
                            <Td py={2} px="0">
                              Subtotal
                            </Td>
                            <Td py={2} isNumeric textAlign="end" px="0">
                              <Skeleton isLoaded={isLoaded}>
                                {formatCurrency(checkoutData?.totals.subtotal) || "100"}
                              </Skeleton>
                            </Td>
                          </Tr>
                          <Tr>
                            <Td py={2} px="0">
                              Tax
                            </Td>
                            <Td py={2} px="0" isNumeric textAlign="end">
                              <Skeleton isLoaded={isLoaded}>
                                {formatCurrency(checkoutData?.totals.tax) || "100"}
                              </Skeleton>
                            </Td>
                          </Tr>
                          <Tr>
                            <Td py={2} px="0">
                              Credits
                            </Td>
                            <Td py={2} px="0" isNumeric textAlign="end">
                              <Skeleton isLoaded={isLoaded}>
                                {formatCurrency(checkoutData?.totals.credit) || "0"}
                              </Skeleton>
                            </Td>
                          </Tr>
                          <Tr>
                            <Td py={2} px="0">
                              <strong>Total Due Today</strong>
                            </Td>
                            <Td py={2} px="0" isNumeric textAlign="end">
                              <Skeleton isLoaded={isLoaded}>
                                <strong>
                                  {formatCurrency(checkoutData?.totals.balance) || "100"}
                                </strong>
                              </Skeleton>
                            </Td>
                          </Tr>
                          <Tr>
                            <Td />
                            <Td />
                          </Tr>
                          <Tr>
                            <Td py={2} px="0">
                              <Text fontSize="sm" color="whiteAlpha.700">
                                Next charge on{" "}
                                <Skeleton display="inline" isLoaded={isLoaded}>
                                  {expirationFormatted}
                                </Skeleton>
                              </Text>
                            </Td>
                            <Td py={2} px="0" isNumeric textAlign="end">
                              <Skeleton isLoaded={isLoaded}>
                                <Text fontSize="sm" color="whiteAlpha.700">
                                  {/** Recurring total may not exist for cancelled subscriptions */}
                                  {checkoutData?.recurringTotals
                                    ? formatCurrency(checkoutData?.recurringTotals.total) || "100"
                                    : "Error"}
                                </Text>
                              </Skeleton>
                            </Td>
                          </Tr>
                        </Tbody>
                      </Table>
                    </TableContainer>
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
            <Text fontSize="sm" color="whiteAlpha.700" textAlign="center">
              If the checkout form does not fully load, please try refreshing the page or using a
              different browser.
            </Text>
          </Stack>
        </BoxConstrained.Container>
      </BoxConstrained.Wrapper>
    </DashboardContentV2>
  );
};
