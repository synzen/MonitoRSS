import {
  Box,
  Button,
  Divider,
  HStack,
  Heading,
  Link,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Skeleton,
  Stack,
  Text,
} from "@chakra-ui/react";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  useCreateSubscriptionCancel,
  useCreateSubscriptionChange,
  useSubscriptionChangePreview,
} from "../../features/subscriptionProducts";
import { InlineErrorAlert } from "../InlineErrorAlert";
import { notifyError } from "../../utils/notifyError";
import { notifySuccess } from "../../utils/notifySuccess";
import { ProductKey } from "../../constants";

interface Props {
  onClose: (reopenPricing?: boolean) => void;
  details?: {
    priceId: string;
  };
  isDowngrade?: boolean;
  billingPeriodEndsAt?: string;
  products?: {
    id: ProductKey;
    name: string;
    prices: {
      id: string;
      interval: "month" | "year" | "day" | "week";
      formattedPrice: string;
      currencyCode: string;
    }[];
  }[];
}

export const ChangeSubscriptionDialog = ({
  details,
  onClose,
  isDowngrade,
  billingPeriodEndsAt,
  products,
}: Props) => {
  const priceId = details?.priceId;
  const product =
    priceId && products
      ? products.find((p) => p.prices.find((pr) => pr.id === priceId))
      : undefined;

  const price = product?.prices.find((p) => p.id === priceId);

  const isChangingToFree = priceId?.startsWith("free");
  const { mutateAsync, status: createStatus } = useCreateSubscriptionChange();
  const { mutateAsync: cancelSubscription, status: cancelStatus } = useCreateSubscriptionCancel();
  const initialRef = useRef<HTMLButtonElement>(null);
  const { t } = useTranslation();

  const isOpen = !!priceId;
  const { data, error } = useSubscriptionChangePreview({
    data:
      priceId && !isChangingToFree
        ? {
            priceId,
          }
        : undefined,
  });

  const onConfirm = async () => {
    if (!priceId) {
      return;
    }

    try {
      if (isChangingToFree) {
        await cancelSubscription();
      } else {
        await mutateAsync({
          data: {
            priceId,
          },
        });
      }

      notifySuccess(t("common.success.savedChanges"));
      onClose();
    } catch (e) {
      notifyError(t("common.errors.somethingWentWrong"), (e as Error).message);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => onClose(true)}
      size="xl"
      motionPreset="slideInBottom"
      isCentered
      scrollBehavior="outside"
      closeOnOverlayClick={false}
      closeOnEsc={false}
      initialFocusRef={initialRef}
    >
      <ModalOverlay backdropFilter="blur(3px)" bg="blackAlpha.700" />
      <ModalContent>
        <ModalHeader>Confirm Subscription Changes</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          {/* {!isChangingToFree && status === "loading" && (
            <Center>
              <Spinner />
            </Center>
          )} */}
          {error && <InlineErrorAlert title="Failed to get preview" description={error.message} />}
          {isChangingToFree && (
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
          {!isChangingToFree && (
            <Stack spacing={8}>
              <Stack spacing={8}>
                <Stack>
                  <Box>
                    <Text>{product?.name}</Text>
                    {!data && <Skeleton width={64} height={12} mt={2} />}
                    {data && price && (
                      <Heading size="lg">
                        {price?.formattedPrice}/{price?.interval}
                      </Heading>
                    )}
                    {!data && <Skeleton width={64} height={6} mt={2} />}
                    {data && (
                      <Text color="whiteAlpha.700">
                        {new Date(
                          data.data.immediateTransaction.billingPeriod.startsAt
                        ).toLocaleDateString(undefined, {
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                        })}
                        {" - "}
                        {new Date(
                          data.data.immediateTransaction.billingPeriod.endsAt
                        ).toLocaleDateString(undefined, {
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </Text>
                    )}
                  </Box>
                </Stack>
                <Divider />
                <Stack>
                  <HStack justifyContent="space-between">
                    <Box>
                      <Text>Subtotal</Text>
                      <Text color="whiteAlpha.700" fontSize={14}>
                        for remaining time on new plan
                      </Text>
                    </Box>
                    {!data && <Skeleton width={16} height={6} />}
                    {data && <Text>{data.data.immediateTransaction.subtotalFormatted}</Text>}
                  </HStack>
                  <HStack justifyContent="space-between">
                    <Box>
                      <Text>Tax</Text>
                      <Text color="whiteAlpha.700" fontSize={14}>
                        Included in plan price
                      </Text>
                    </Box>
                    {!data && <Skeleton width={16} height={6} />}
                    {data && <Text>{data.data.immediateTransaction.taxFormatted}</Text>}
                  </HStack>
                  <HStack justifyContent="space-between">
                    <Box>
                      <Text>Total</Text>
                    </Box>
                    {!data && <Skeleton width={16} height={6} />}
                    {data && <Text>{data.data.immediateTransaction.totalFormatted}</Text>}
                  </HStack>
                  {data && data.data.immediateTransaction.credit !== "0" && (
                    <HStack justifyContent="space-between">
                      <Box>
                        <Text>Credit</Text>
                        <Text color="whiteAlpha.700" fontSize={14}>
                          Includes refund for time remaining on current plan
                        </Text>
                      </Box>
                      {!data && <Skeleton width={16} height={6} />}
                      {data && (
                        <Text color="green.200">
                          -{data.data.immediateTransaction.creditFormatted}
                        </Text>
                      )}
                    </HStack>
                  )}
                  <Divider my={4} />
                  <HStack justifyContent="space-between">
                    <Text fontWeight="semibold">Due Today</Text>
                    {!data && <Skeleton width={16} height={6} />}
                    {data && (
                      <Text fontWeight="bold">
                        {data.data.immediateTransaction.grandTotalFormatted}
                      </Text>
                    )}
                  </HStack>
                </Stack>
              </Stack>
              <Text color="whiteAlpha.700">
                By proceeding, you are agreeing to our{" "}
                <Link target="_blank" href="https://monitorss.xyz/terms" color="blue.300">
                  terms and conditions
                </Link>{" "}
                and{" "}
                <Link target="_blank" color="blue.300" href="https://monitorss.xyz/privacy-policy">
                  privacy policy
                </Link>
                .
              </Text>
            </Stack>
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={() => onClose(true)} ref={initialRef}>
            Cancel
          </Button>
          <Button
            colorScheme={!isDowngrade ? "blue" : "red"}
            onClick={onConfirm}
            isLoading={
              (!isChangingToFree && !data) ||
              createStatus === "loading" ||
              cancelStatus === "loading"
            }
            isDisabled={
              !isChangingToFree &&
              (createStatus === "loading" || cancelStatus === "loading" || !data)
            }
          >
            {!isDowngrade && "Confirm Payment"}
            {isDowngrade && "Confirm Downgrade"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
