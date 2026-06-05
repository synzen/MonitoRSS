import {
  Box,
  Button,
  Flex,
  Link,
  Skeleton,
  Spinner,
  Stack,
  TableBody,
  TableCell,
  TableRoot,
  TableRow,
  TableScrollArea,
  Text,
} from "@chakra-ui/react";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  useCreateSubscriptionCancel,
  useCreateSubscriptionChange,
  useSubscriptionChangePreview,
} from "@/features/subscriptionProducts";
import { InlineErrorAlert } from "@/components/InlineErrorAlert";
import { notifyError } from "@/utils/notifyError";
import { notifySuccess } from "@/utils/notifySuccess";
import { ProductKey, TOP_LEVEL_PRODUCTS } from "@/constants";
import {
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
  DialogCloseTrigger,
} from "@/components/ui/dialog";

interface Props {
  onClose: (reopenPricing?: boolean) => void;
  details?: {
    prices: Array<{
      productKey: ProductKey;
      productName: string;
      formattedPrice: string;
      interval: "month" | "year" | "day" | "week";
      priceId: string;
      quantity: number;
    }>;
  };
  isDowngrade?: boolean;
  billingPeriodEndsAt?: string;
  // products?: {
  //   id: ProductKey;
  //   name: string;
  //   prices: {
  //     id: string;
  //     interval: "month" | "year" | "day" | "week";
  //     formattedPrice: string;
  //     currencyCode: string;
  //   }[];
  // }[];
}

export const ChangeSubscriptionDialog = ({
  details,
  onClose,
  isDowngrade,
  billingPeriodEndsAt,
}: Props) => {
  // const priceId = details?.prices;
  const pricesToUseForUpdate = details?.prices;
  const topLevelPriceToUseForUpdate = pricesToUseForUpdate
    ? pricesToUseForUpdate.find((p) => TOP_LEVEL_PRODUCTS.includes(p.productKey))
    : undefined;

  const additionalFeedsPriceToUseForUpdate = pricesToUseForUpdate
    ? pricesToUseForUpdate.find((p) => p.productKey === ProductKey.Tier3Feed)
    : undefined;

  // const price = product?.prices.find((p) => p.id === priceId);

  const isChangingToFree = details?.prices.some((p) => p.priceId.startsWith("free"));
  const { mutateAsync, status: createStatus } = useCreateSubscriptionChange();
  const { mutateAsync: cancelSubscription, status: cancelStatus } = useCreateSubscriptionCancel();
  const initialRef = useRef<HTMLButtonElement>(null);
  const { t } = useTranslation();

  const isOpen = !!details?.prices && details.prices.length > 0;
  const { data, error } = useSubscriptionChangePreview({
    data:
      details?.prices && !isChangingToFree
        ? {
            prices: details.prices.map((p) => ({
              priceId: p.priceId,
              quantity: p.quantity,
            })),
          }
        : undefined,
  });

  const onConfirm = async () => {
    if (!pricesToUseForUpdate) {
      return;
    }

    if ((!isChangingToFree && !data) || createStatus === "loading" || cancelStatus === "loading") {
      return;
    }

    try {
      if (isChangingToFree) {
        await cancelSubscription();
      } else {
        await mutateAsync({
          data: {
            prices: pricesToUseForUpdate.map((p) => ({
              priceId: p.priceId,
              quantity: p.quantity,
            })),
          },
        });
      }

      notifySuccess(t("common.success.savedChanges"));
      onClose();
    } catch (e) {
      notifyError(t("common.errors.somethingWentWrong"), (e as Error).message);
    }
  };

  const isLoading = !data && !isChangingToFree;

  return (
    <DialogRoot
      open={isOpen}
      onOpenChange={(e) => {
        if (!e.open) {
          onClose(true);
        }
      }}
      size="xl"
      initialFocusEl={() => initialRef.current}
    >
      <DialogContent>
        <DialogHeader marginRight={4}>
          <DialogTitle>Confirm Subscription Changes</DialogTitle>
        </DialogHeader>
        <DialogCloseTrigger />
        <DialogBody>
          {isLoading && !error && (
            <Flex justifyContent="center" m={6}>
              <Spinner />
            </Flex>
          )}
          {error && (
            <InlineErrorAlert
              title="Failed to get preview of subscription changes"
              description={error.message}
            />
          )}
          {!isLoading && isChangingToFree && (
            <Stack>
              <Text>
                Are you sure you want to cancel by downgrading to Free? You will retain your current
                plan until{" "}
                {billingPeriodEndsAt &&
                  new Date(billingPeriodEndsAt).toLocaleDateString(undefined, {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                .
              </Text>
            </Stack>
          )}
          <Box aria-live="polite" aria-atomic="true">
            {!isLoading && !isChangingToFree && (
              <Stack>
                <Stack gap={8}>
                  <Stack>
                    <Box>
                      <Flex alignItems="baseline" gap={3} flexWrap="wrap">
                        <Text>{topLevelPriceToUseForUpdate?.productName}</Text>
                        {additionalFeedsPriceToUseForUpdate && (
                          <Text fontSize="sm" color="fg.muted">
                            + {additionalFeedsPriceToUseForUpdate.quantity} additional feed
                            {additionalFeedsPriceToUseForUpdate.quantity > 1 ? "s" : ""}
                          </Text>
                        )}
                      </Flex>
                      {!data && <Skeleton width={64} height={12} mt={2} />}
                      {data && topLevelPriceToUseForUpdate && (
                        <Flex alignItems="baseline" gap={3} flexWrap="wrap">
                          <Text fontSize="xx-large" fontWeight={700}>
                            {topLevelPriceToUseForUpdate?.formattedPrice}/
                            {topLevelPriceToUseForUpdate?.interval}
                          </Text>
                          {additionalFeedsPriceToUseForUpdate && (
                            <Text fontSize="lg" fontWeight={500} color="fg">
                              + {additionalFeedsPriceToUseForUpdate.formattedPrice}/
                              {additionalFeedsPriceToUseForUpdate.interval}
                            </Text>
                          )}
                        </Flex>
                      )}
                      {!data && <Skeleton width={64} height={6} mt={2} />}
                      {data && (
                        <Text color="fg.muted">
                          {new Date(
                            data.data.immediateTransaction.billingPeriod.startsAt,
                          ).toLocaleDateString(undefined, {
                            month: "long",
                            day: "numeric",
                            year: "numeric",
                          })}
                          {" - "}
                          {new Date(
                            data.data.immediateTransaction.billingPeriod.endsAt,
                          ).toLocaleDateString(undefined, {
                            month: "long",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </Text>
                      )}
                    </Box>
                  </Stack>
                  <TableScrollArea pt={4} tabIndex={-1}>
                    <TableRoot variant="line">
                      <TableBody>
                        <TableRow>
                          <TableCell padding={0}>
                            <Text>Subtotal</Text>
                            <Text color="fg.muted" fontSize={14}>
                              for remaining time on new plan
                            </Text>
                          </TableCell>
                          <TableCell textAlign="right" p={0}>
                            <Flex justifyContent="flex-end">
                              {!data && <Skeleton width={16} height={6} />}
                              {data && (
                                <Text>{data.data.immediateTransaction.subtotalFormatted}</Text>
                              )}
                            </Flex>
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell pt={4} pl={0} pr={0} pb={0}>
                            <Text>Tax</Text>
                            <Text color="fg.muted" fontSize={14}>
                              Included in plan price
                            </Text>
                          </TableCell>
                          <TableCell textAlign="right" p={0}>
                            <Flex justifyContent="flex-end">
                              {!data && <Skeleton width={16} height={6} />}
                              {data && <Text>{data.data.immediateTransaction.taxFormatted}</Text>}
                            </Flex>
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell pt={4} pl={0} pr={0} pb={0}>
                            <Text>Total</Text>
                          </TableCell>
                          <TableCell textAlign="right" p={0}>
                            <Flex justifyContent="flex-end">
                              {!data && <Skeleton width={16} height={6} />}
                              {data && <Text>{data.data.immediateTransaction.totalFormatted}</Text>}
                            </Flex>
                          </TableCell>
                        </TableRow>
                        {data && data.data.immediateTransaction.credit !== "0" && (
                          <TableRow>
                            <TableCell pt={4} pl={0} pr={0} pb={0}>
                              <Text>Credit</Text>
                              <Text color="fg.muted" fontSize={14}>
                                Includes refund for time remaining on current plan
                              </Text>
                            </TableCell>
                            <TableCell p={0} textAlign="right">
                              <Flex justifyContent="flex-end">
                                {!data && <Skeleton width={16} height={6} />}
                                {data && (
                                  <Text color="text.success">
                                    -{data.data.immediateTransaction.creditFormatted}
                                  </Text>
                                )}
                              </Flex>
                            </TableCell>
                          </TableRow>
                        )}
                        <TableRow>
                          <TableCell pt={8} pl={0} pr={0} pb={0}>
                            <Text fontWeight="bold">Due Today</Text>
                          </TableCell>
                          <TableCell textAlign="right" pt={8} pl={0} pr={0} pb={0}>
                            <Flex justifyContent="flex-end">
                              {!data && <Skeleton width={16} height={6} />}
                              {data && (
                                <Text fontWeight="bold">
                                  {data.data.immediateTransaction.grandTotalFormatted}
                                </Text>
                              )}
                            </Flex>
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </TableRoot>
                  </TableScrollArea>
                </Stack>
                <Text color="fg.muted" pt={4}>
                  By proceeding, you are agreeing to our{" "}
                  <Link target="_blank" href="https://monitorss.xyz/terms" color="text.link">
                    terms and conditions
                  </Link>{" "}
                  and{" "}
                  <Link
                    target="_blank"
                    color="text.link"
                    href="https://monitorss.xyz/privacy-policy"
                  >
                    privacy policy
                  </Link>
                  .
                </Text>
              </Stack>
            )}
          </Box>
        </DialogBody>
        <DialogFooter>
          {!isLoading && (
            <>
              <Button variant="ghost" mr={3} onClick={() => onClose(true)} ref={initialRef}>
                <span>Cancel</span>
              </Button>
              <Button
                variant="solid"
                colorPalette={!isDowngrade ? "brand" : "red"}
                onClick={onConfirm}
                aria-disabled={
                  (!isChangingToFree && !data) ||
                  createStatus === "loading" ||
                  cancelStatus === "loading"
                }
              >
                <span>
                  {!isDowngrade && "Confirm Payment"}
                  {isDowngrade && "Confirm Downgrade"}
                </span>
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
};
