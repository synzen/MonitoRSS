import {
  Box,
  Button,
  Center,
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
  Spinner,
  Stack,
  Text,
} from "@chakra-ui/react";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  useCreateSubscriptionCancel,
  useCreateSubscriptionChange,
  useSubscriptionChangePreview,
  useSubscriptionProducts,
} from "../../features/subscriptionProducts";
import { InlineErrorAlert } from "../InlineErrorAlert";
import { notifyError } from "../../utils/notifyError";
import { notifySuccess } from "../../utils/notifySuccess";

interface Props {
  onClose: (reopenPricing?: boolean) => void;
  currencyCode: string;
  details?: {
    priceId: string;
  };
  isDowngrade?: boolean;
}

export const ChangeSubscriptionDialog = ({
  currencyCode,
  details,
  onClose,
  isDowngrade,
}: Props) => {
  const { data: productsData } = useSubscriptionProducts({
    currency: currencyCode,
  });
  const { mutateAsync, status: createStatus } = useCreateSubscriptionChange();
  const { mutateAsync: cancelSubscription, status: cancelStatus } = useCreateSubscriptionCancel();
  const initialRef = useRef<HTMLButtonElement>(null);
  const { t } = useTranslation();
  const priceId = details?.priceId;

  const isOpen = !!(priceId && currencyCode);
  const { data, status, error } = useSubscriptionChangePreview({
    data:
      currencyCode && priceId
        ? {
            currencyCode,
            priceId,
          }
        : undefined,
  });

  const product = priceId
    ? productsData?.data.products.find((p) => p.prices.find((pr) => pr.id === priceId))
    : undefined;

  const price = product?.prices.find((p) => p.id === priceId);

  const isChangingToFree = product?.id === "free";

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
            currencyCode,
          },
        });
      }

      onClose();
      notifySuccess("Successfully updated!");
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
        <ModalHeader>Subscription Change Summary</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          {status === "loading" && (
            <Center>
              <Spinner />
            </Center>
          )}
          {error && <InlineErrorAlert title="Failed to get preview" description={error.message} />}
          {data && isChangingToFree && (
            <Stack>
              <Text>Are you sure you want to cancel by downgrading to Free?</Text>
            </Stack>
          )}
          {data && !isChangingToFree && (
            <Stack spacing={8}>
              <Stack spacing={8}>
                <Stack>
                  <Box>
                    <Text>{product?.name}</Text>
                    <Heading size="lg">
                      {price?.formattedPrice}/{price?.interval}
                    </Heading>
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
                  </Box>
                </Stack>
                <Stack>
                  {/* <Heading size="md">Due Today</Heading> */}
                  <HStack justifyContent="space-between">
                    <Text>Subtotal</Text>
                    <Text>{data.data.immediateTransaction.totalFormatted}</Text>
                  </HStack>
                  {data.data.immediateTransaction.credit !== "0" && (
                    <HStack justifyContent="space-between">
                      <Box>
                        <Text>Credit</Text>
                        <Text color="whiteAlpha.700">for remaining time on current plan</Text>
                      </Box>
                      <Text color="green.200">
                        -{data.data.immediateTransaction.creditFormatted}
                      </Text>
                    </HStack>
                  )}
                  <Divider my={4} />
                  <HStack justifyContent="space-between">
                    <Text fontWeight="semibold">Due Today</Text>
                    <Text fontWeight="bold">
                      {data.data.immediateTransaction.grandTotalFormatted}
                    </Text>
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
            isLoading={createStatus === "loading" || cancelStatus === "loading"}
          >
            {!isDowngrade && "Confirm Payment"}
            {isDowngrade && "Confirm Downgrade"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
