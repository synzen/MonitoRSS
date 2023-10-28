import {
  Alert,
  AlertDescription,
  AlertTitle,
  Box,
  Button,
  Divider,
  Flex,
  FormControl,
  FormHelperText,
  FormLabel,
  HStack,
  Heading,
  Stack,
  Switch,
  Text,
  chakra,
} from "@chakra-ui/react";
import { RepeatIcon } from "@chakra-ui/icons";
import { InferType, bool, object } from "yup";
import { yupResolver } from "@hookform/resolvers/yup";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { GetUserMeOutput, useUpdateUserMe, useUserMe } from "../features/discordUser";
import { BoxConstrained, ConfirmModal, DashboardContentV2, PricingDialog } from "../components";
import { useLogin } from "../hooks";
import { notifyError } from "../utils/notifyError";
import { notifySuccess } from "../utils/notifySuccess";
import { useCreateSubscriptionResume } from "../features/subscriptionProducts/hooks/useCreateSubscriptionResume";

const formSchema = object({
  alertOnDisabledFeeds: bool(),
});

type FormData = InferType<typeof formSchema>;

const convertUserMeToFormData = (getUserMeOutput?: GetUserMeOutput): FormData => {
  return {
    alertOnDisabledFeeds: !!getUserMeOutput?.result?.preferences?.alertOnDisabledFeeds,
  };
};

export const UserSettings = () => {
  const [checkForSubscriptionUpdateAfter, setCheckForSubscriptionUpdateAfter] = useState<Date>();
  console.log(
    "🚀 ~ file: UserSettings.tsx:46 ~ UserSettings ~ checkForSubscriptionUpdateAfter:",
    checkForSubscriptionUpdateAfter
  );
  const { status, error, data } = useUserMe({
    checkForSubscriptionUpdateAfter,
  });
  const { t } = useTranslation();
  const { mutateAsync } = useUpdateUserMe();
  const { redirectToLogin } = useLogin();
  const { mutateAsync: resumeSubscription } = useCreateSubscriptionResume();
  const {
    handleSubmit,
    control,
    formState: { isSubmitting, isDirty },
    reset,
  } = useForm<FormData>({
    resolver: yupResolver(formSchema),
    mode: "all",
  });
  const hasLoaded = status !== "loading";

  useEffect(() => {
    reset(convertUserMeToFormData(data));
  }, [hasLoaded]);

  const hasEmailAvailable = !!data?.result?.email;

  const onClickGrantEmailAccess = () => {
    redirectToLogin({
      addScopes: "email",
    });
  };

  const onSubmit = async ({ alertOnDisabledFeeds }: FormData) => {
    try {
      const response = await mutateAsync({
        details: {
          preferences: {
            alertOnDisabledFeeds,
          },
        },
      });
      reset(convertUserMeToFormData(response));
      notifySuccess(t("common.success.savedChanges"));
    } catch (err) {
      notifyError(t("common.errors.somethingWentWrong"), (err as Error).message);
    }
  };

  const onClickResumeSubscription = async () => {
    try {
      const beforeUpdateDate = new Date();
      await resumeSubscription();
      setCheckForSubscriptionUpdateAfter(beforeUpdateDate);
    } catch (err) {
      notifyError(t("common.errors.somethingWentWrong"), (err as Error).message);
    }
  };

  // Handle polling result after clicking resume subscription
  const subscriptionLastUpdated = data?.result.subscription.updatedAt;
  useEffect(() => {
    if (!subscriptionLastUpdated || !checkForSubscriptionUpdateAfter) {
      return;
    }

    if (new Date(subscriptionLastUpdated).getTime() > checkForSubscriptionUpdateAfter.getTime()) {
      setCheckForSubscriptionUpdateAfter(undefined);
      notifySuccess(t("common.success.savedChanges"));
    }
  }, [subscriptionLastUpdated, checkForSubscriptionUpdateAfter]);

  const subscription = data?.result.subscription;
  const subscriptionPendingCancellation = subscription && subscription?.cancellationDate;

  let subscriptionText: React.ReactNode;

  if (subscription?.cancellationDate) {
    subscriptionText = (
      <Text>
        You are currently on{" "}
        <chakra.span fontWeight={600}>{subscription?.product.name}</chakra.span>, scheduled to be
        cancelled on{" "}
        {new Date(subscription.cancellationDate).toLocaleDateString(undefined, {
          year: "numeric",
          month: "long",
          day: "numeric",
        })}
        .
      </Text>
    );
  } else if (subscription?.nextBillDate) {
    subscriptionText = (
      <Text>
        You are currently on{" "}
        <chakra.span fontWeight={600}>{subscription?.product.name}</chakra.span>, scheduled to renew
        on{" "}
        {new Date(subscription.nextBillDate).toLocaleDateString(undefined, {
          year: "numeric",
          month: "long",
          day: "numeric",
        })}
        .
      </Text>
    );
  } else {
    subscriptionText = (
      <Text>
        You are currently on{" "}
        <chakra.span fontWeight={600}>{subscription?.product.name}</chakra.span>.
      </Text>
    );
  }

  return (
    <DashboardContentV2 error={error} loading={status === "loading"}>
      <BoxConstrained.Wrapper>
        <BoxConstrained.Container paddingTop={10} spacing={6} paddingBottom={32}>
          <Stack spacing={8}>
            <Stack justifyContent="flex-start" width="100%">
              <Heading>Settings</Heading>
            </Stack>
            <Stack spacing={8}>
              <Heading size="md">Account</Heading>
              <Stack>
                <Text fontWeight={600} color="whiteAlpha.700">
                  Email
                </Text>
                <Flex justifyContent="space-between" alignItems="center" flexWrap="wrap">
                  <Text>
                    {data?.result?.email || (
                      <chakra.span color="gray.560">(no email available)</chakra.span>
                    )}
                  </Text>
                  <Button
                    variant="link"
                    color="blue.300"
                    leftIcon={<RepeatIcon />}
                    onClick={onClickGrantEmailAccess}
                  >
                    Refresh Email
                  </Button>
                </Flex>
              </Stack>
            </Stack>
            <Divider />
            <Stack spacing={8}>
              <Stack>
                <Heading size="md">Billing</Heading>
              </Stack>
              {!hasEmailAvailable && (
                <Alert status="warning" borderRadius="md">
                  <Stack>
                    <AlertTitle>
                      To enable billing for subscriptions, your email is required
                    </AlertTitle>
                    <AlertDescription>
                      <Button variant="solid" colorScheme="blue" onClick={onClickGrantEmailAccess}>
                        Grant email access
                      </Button>
                    </AlertDescription>
                  </Stack>
                </Alert>
              )}
              {hasEmailAvailable && (
                <Stack>
                  {data && (
                    <Stack spacing={8}>
                      <Stack>
                        <Text fontWeight={600} color="whiteAlpha.700">
                          Credit Balance
                        </Text>
                        <Stack spacing={3}>
                          <Text fontSize="xl" fontWeight="semibold">
                            {data.result.creditBalance.availableFormatted}
                          </Text>
                        </Stack>
                      </Stack>
                      <Stack>
                        <Text fontWeight={600} color="whiteAlpha.700">
                          Current Subscription Tier
                        </Text>
                        <Stack spacing={3}>
                          {subscriptionText}
                          {subscriptionPendingCancellation && (
                            <Box>
                              <ConfirmModal
                                trigger={
                                  <Button size="sm" variant="solid" colorScheme="blue">
                                    Resume subscription
                                  </Button>
                                }
                                onConfirm={onClickResumeSubscription}
                                okText="Resume subscription"
                                colorScheme="blue"
                                description="Are you sure you want to resume your subscription?"
                                title="Resume subscription"
                              />
                            </Box>
                          )}
                          {!subscriptionPendingCancellation && (
                            <HStack>
                              <PricingDialog
                                trigger={
                                  <Button size="sm" variant="outline">
                                    Manage Subscription
                                  </Button>
                                }
                              />
                            </HStack>
                          )}
                        </Stack>
                      </Stack>
                    </Stack>
                  )}
                </Stack>
              )}
            </Stack>
            <Divider />
            <Stack spacing={8}>
              <Stack>
                <Heading size="md">Events</Heading>
                <Text>Get emailed when events happen that may affect article delivery.</Text>
              </Stack>
              {!hasEmailAvailable && (
                <Alert status="warning" borderRadius="md">
                  <Stack>
                    <AlertTitle>To enable notifications, your email is required</AlertTitle>
                    <AlertDescription>
                      <Button variant="solid" colorScheme="blue" onClick={onClickGrantEmailAccess}>
                        Grant email access
                      </Button>
                    </AlertDescription>
                  </Stack>
                </Alert>
              )}
              <form onSubmit={handleSubmit(onSubmit)}>
                <Stack spacing={4}>
                  <FormControl as={Flex} justifyContent="space-between" flexWrap="wrap" gap={4}>
                    <Box>
                      <FormLabel htmlFor="email-alerts">
                        Disabled feed or feed connections
                      </FormLabel>
                      <FormHelperText>
                        Whenever feed or feed connections automatically get disabled due to issues
                        while processing.
                      </FormHelperText>
                    </Box>
                    <Controller
                      name="alertOnDisabledFeeds"
                      control={control}
                      render={({ field }) => {
                        return (
                          <Switch
                            size="lg"
                            isDisabled={!hasLoaded || !hasEmailAvailable || isSubmitting}
                            isChecked={!!field.value}
                            onChange={(e) => field.onChange(e.target.checked)}
                          />
                        );
                      }}
                    />
                  </FormControl>
                  <Flex justifyContent="flex-end">
                    <Button
                      colorScheme="blue"
                      type="submit"
                      isLoading={isSubmitting}
                      isDisabled={!isDirty || isSubmitting}
                      width="min-content"
                    >
                      {t("common.buttons.save")}
                    </Button>
                  </Flex>
                </Stack>
              </form>
            </Stack>
          </Stack>
        </BoxConstrained.Container>
      </BoxConstrained.Wrapper>
    </DashboardContentV2>
  );
};
