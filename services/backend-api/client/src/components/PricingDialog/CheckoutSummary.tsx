/* eslint-disable no-empty-pattern */
import { ArrowBackIcon } from "@chakra-ui/icons";
import {
  Badge,
  Box,
  Button,
  CloseButton,
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
import { captureException } from "@sentry/react";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { CheckoutSummaryData } from "../../types/CheckoutSummaryData";

interface Props {
  onGoBack: () => void;
  onClose: () => void;
  checkoutData?: CheckoutSummaryData;
  onChangeInterval: (i: "month" | "year") => void;
}

const CheckoutSummary = ({ onClose, onGoBack, checkoutData, onChangeInterval }: Props) => {
  const [waitingForUpdate, setWaitingForUpdate] = useState(false);
  const isLoaded = !waitingForUpdate && !!checkoutData;

  useEffect(() => {
    if (!checkoutData) {
      return;
    }

    setWaitingForUpdate(false);
  }, [checkoutData?.item.interval]);

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

  const todayFormatted = dayjs().format("D MMM YYYY");
  const expirationFormatted = checkoutData
    ? dayjs().add(1, checkoutData.item.interval).format("D MMM YYYY")
    : todayFormatted;

  return (
    <Stack
      backdropFilter="blur(3px)"
      alignItems="center"
      justifyContent="center"
      height="100vh"
      position="absolute"
      background="blackAlpha.700"
      top={0}
      left={0}
      width="100vw"
      zIndex={10}
    >
      <Stack maxWidth="5xl" width="100%" mb={24}>
        <Flex justifyContent="flex-end" width="100%">
          <CloseButton onClick={onClose} />
        </Flex>
        <HStack gap={0} bg="gray.700" rounded="md" alignItems="flex-start">
          <Stack flex={1} spacing={4} padding={8}>
            <Box>
              <Button leftIcon={<ArrowBackIcon />} variant="ghost" size="xs" onClick={onGoBack}>
                Go back
              </Button>
            </Box>
            <Heading fontWeight={600} fontSize="md" color="whiteAlpha.700">
              Subscribe to MonitoRSS
            </Heading>
            <Stack spacing={0} borderColor="blackAlpha.300" borderWidth={2} rounded="md">
              <HStack alignItems="center" px={4} pt={4}>
                <Skeleton isLoaded={isLoaded}>
                  <Text fontSize="xl">{checkoutData?.item.productName}</Text>
                </Skeleton>
              </HStack>
              <Box px={4} pb={4}>
                <Skeleton isLoaded={isLoaded}>
                  <Text fontSize="4xl" fontWeight="semibold" display="inline">
                    {formatCurrency(checkoutData?.recurringTotals.total)}
                  </Text>
                  <Text display="inline"> per {checkoutData?.item.interval}</Text>
                </Skeleton>
              </Box>
              <Divider />
              <HStack px={4} py={2} bg="blackAlpha.300">
                <Switch
                  checked={checkoutData?.item.interval === "year"}
                  colorScheme="green"
                  isDisabled={!isLoaded}
                  isChecked={checkoutData?.item.interval === "year"}
                  onChange={(e) => {
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
                        <strong>{formatCurrency(checkoutData?.totals.balance) || "100"}</strong>
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
                          {formatCurrency(checkoutData?.recurringTotals.total) || "100"}
                        </Text>
                      </Skeleton>
                    </Td>
                  </Tr>
                </Tbody>
              </Table>
            </TableContainer>
          </Stack>
          <Flex
            flex={1}
            className="checkout-modal"
            bg="white"
            borderTopRightRadius="md"
            borderBottomRightRadius="md"
          />
        </HStack>
      </Stack>
    </Stack>
  );
};

export default CheckoutSummary;
