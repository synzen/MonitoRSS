import {
  Accordion,
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Box,
  Button,
  Divider,
  Flex,
  FormControl,
  FormHelperText,
  FormLabel,
  HStack,
  Heading,
  Input,
  Link,
  ListItem,
  OrderedList,
  Stack,
  Switch,
  Text,
  chakra,
} from "@chakra-ui/react";
import { RepeatIcon } from "@chakra-ui/icons";
import { InferType, bool, object, string } from "yup";
import { yupResolver } from "@hookform/resolvers/yup";
import { Controller, FormProvider, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useContext, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import dayjs from "dayjs";
import { captureException } from "@sentry/react";
import { GetUserMeOutput, useUpdateUserMe, useUserMe } from "../features/discordUser";
import {
  BoxConstrained,
  ConfirmModal,
  DashboardContentV2,
  SavedUnsavedChangesPopupBar,
} from "../components";
import { useLogin } from "../hooks";
import { useCreateSubscriptionResume } from "../features/subscriptionProducts/hooks/useCreateSubscriptionResume";
import { ProductKey } from "../constants";
import getChakraColor from "../utils/getChakraColor";
import { useGetUpdatePaymentMethodTransaction } from "../features/subscriptionProducts";
import { PricingDialogContext } from "../contexts";
import { DatePreferencesForm } from "../components/DatePreferencesForm";
import { usePaddleContext } from "../contexts/PaddleContext";
import { useRemoveRedditLogin } from "../features/feed/hooks/useRemoveRedditLogin";
import { RedditLoginButton } from "../components/RedditLoginButton/RedditLoginButton";
import {
  PageAlertContextOutlet,
  PageAlertProvider,
  usePageAlertContext,
} from "../contexts/PageAlertContext";

const formSchema = object({
  alertOnDisabledFeeds: bool(),
  dates: object({
    format: string(),
    timezone: string().test("is-timezone", "Must be a valid timezone", (val) => {
      if (!val) {
        return true;
      }

      try {
        dayjs().tz(val);

        return true;
      } catch (err) {
        if (err instanceof RangeError) {
          return false;
        }

        throw err;
      }
    }),
    locale: string(),
  }),
});

type FormData = InferType<typeof formSchema>;

const convertUserMeToFormData = (getUserMeOutput?: GetUserMeOutput): FormData => {
  return {
    alertOnDisabledFeeds: !!getUserMeOutput?.result?.preferences?.alertOnDisabledFeeds,
    dates: {
      format: getUserMeOutput?.result?.preferences?.dateFormat || undefined,
      timezone: getUserMeOutput?.result?.preferences?.dateTimezone || undefined,
      locale: getUserMeOutput?.result?.preferences?.dateLocale || undefined,
    },
  };
};

const ChangePaymentMethodUrlButton = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const transactionIdFromQuery = searchParams.get("_ptxn");
  const { data } = useUserMe();
  const enabled = data && data?.result.subscription.product.key !== ProductKey.Free;
  const { error, refetch, fetchStatus } = useGetUpdatePaymentMethodTransaction({
    enabled: enabled && !transactionIdFromQuery,
  });
  const { updatePaymentMethod } = usePaddleContext();
  const { createErrorAlert } = usePageAlertContext();

  useEffect(() => {
    if (!transactionIdFromQuery) {
      return;
    }

    updatePaymentMethod(transactionIdFromQuery);

    setSearchParams(new URLSearchParams());
  }, [transactionIdFromQuery, updatePaymentMethod]);

  if (!enabled) {
    return null;
  }

  const onClick = async () => {
    try {
      const result = await refetch();
      const transactionId = result.data?.data.paddleTransactionId;

      if (!transactionId) {
        return;
      }

      updatePaymentMethod(transactionId);
    } catch (err) {
      createErrorAlert({
        title: "Unable to change payment method due to internal error.",
        description: (err as Error).message,
      });
      captureException(err);
    }
  };

  return (
    <Box>
      <Button
        size="sm"
        variant="outline"
        isLoading={fetchStatus === "fetching"}
        onClick={() => {
          if (error) {
            return;
          }

          onClick();
        }}
        aria-disabled={!!error}
        colorScheme={error ? "red" : undefined}
      >
        <span>
          {error ? "Failed to load change payment method button" : "Change Payment Method"}
        </span>
      </Button>
    </Box>
  );
};

export const UserSettings = () => {
  const { status, error } = useUserMe();

  return (
    <PageAlertProvider>
      <DashboardContentV2 error={error} loading={status === "loading"}>
        <Flex alignItems="center" flexDir="column" isolation="isolate">
          <PageAlertContextOutlet
            containerProps={{
              maxW: "1400px",
              w: "100%",
              display: "flex",
              justifyContent: "center",
              px: [4, 4, 8, 12],
              pt: 2,
              pb: 2,
            }}
          />
          <BoxConstrained.Wrapper>
            <BoxConstrained.Container paddingTop={4} spacing={6} paddingBottom={120}>
              <UserSettingsInner />
            </BoxConstrained.Container>
          </BoxConstrained.Wrapper>
        </Flex>
      </DashboardContentV2>
    </PageAlertProvider>
  );
};

const UserSettingsInner = () => {
  const { status, data, refetch } = useUserMe();
  const { t } = useTranslation();
  const { mutateAsync } = useUpdateUserMe();
  const { onOpen: onOpenPricingDialog } = useContext(PricingDialogContext);
  const { redirectToLogin } = useLogin();
  const { mutateAsync: resumeSubscription } = useCreateSubscriptionResume();
  const subscription = data?.result.subscription;
  const formMethods = useForm<FormData>({
    resolver: yupResolver(formSchema),
    mode: "all",
  });
  const {
    handleSubmit,
    control,
    formState: { isSubmitting, errors },
    reset,
  } = formMethods;
  const { mutateAsync: removeRedditLogin, status: removeRedditLoginStatus } =
    useRemoveRedditLogin();
  const { createSuccessAlert, createErrorAlert } = usePageAlertContext();
  const hasLoaded = status !== "loading";

  const onClickRemoveRedditLogin = async () => {
    try {
      await removeRedditLogin();
      createSuccessAlert({
        title: "Successfully removed Reddit login.",
      });
    } catch (err) {
      createErrorAlert({
        title: "Failed to remove Reddit login.",
        description: (err as Error).message,
      });
    }
  };

  useEffect(() => {
    reset(convertUserMeToFormData(data));
  }, [hasLoaded]);

  const hasEmailAvailable = !!data?.result?.email;

  const onClickGrantEmailAccess = () => {
    redirectToLogin({
      addScopes: "email",
    });
  };

  const onSubmit = async ({
    alertOnDisabledFeeds,
    dates: { format: dateFormat, locale: dateLocale, timezone: dateTimezone },
  }: FormData) => {
    try {
      const response = await mutateAsync({
        details: {
          preferences: {
            alertOnDisabledFeeds,
            dateFormat,
            dateLocale,
            dateTimezone,
          },
        },
      });
      reset(convertUserMeToFormData(response));
      createSuccessAlert({
        title: "Successfully updated settings.",
      });
    } catch (err) {
      createErrorAlert({
        title: "Failed to update settings.",
        description: (err as Error).message,
      });
    }
  };

  const onClickResumeSubscription = async () => {
    try {
      await resumeSubscription();
      await refetch();
      createSuccessAlert({
        title: "Successfully resumed subscription.",
      });
    } catch (err) {
      createErrorAlert({
        title: "Failed to resume subscription.",
        description: (err as Error).message,
      });
    }
  };

  const subscriptionPendingCancellation = subscription && subscription?.cancellationDate;

  // Get additional feeds count
  const additionalFeedsCount =
    subscription?.addons?.find((addon) => addon.key === ProductKey.Tier3Feed)?.quantity || 0;

  // Helper function to format tier name with additional feeds
  const formatTierName = (tierName: string) => {
    if (additionalFeedsCount > 0) {
      return `${tierName} + ${additionalFeedsCount} additional feed${
        additionalFeedsCount > 1 ? "s" : ""
      }`;
    }

    return tierName;
  };

  let subscriptionText: React.ReactNode;

  if (subscription?.cancellationDate) {
    subscriptionText = (
      <Text>
        You are currently on{" "}
        <chakra.span fontWeight={600}>
          {formatTierName(subscription?.product.name)} (billed every {subscription.billingInterval})
        </chakra.span>
        , scheduled to be cancelled on{" "}
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
        <chakra.span fontWeight={600}>
          {formatTierName(subscription?.product.name)} (billed every {subscription.billingInterval})
        </chakra.span>
        , scheduled to renew on{" "}
        {new Date(subscription.nextBillDate).toLocaleDateString(undefined, {
          year: "numeric",
          month: "long",
          day: "numeric",
        })}
        .
      </Text>
    );
  } else if (subscription) {
    subscriptionText = (
      <Text>
        You are currently on{" "}
        <chakra.span fontWeight={600}>
          {formatTierName(subscription.product.name)}
          {subscription.billingInterval && ` (billed every ${subscription.billingInterval})`}
        </chakra.span>
        .
      </Text>
    );
  }

  const redditConnected = data?.result.externalAccounts?.some((a) => a.type === "reddit");

  return (
    <Stack spacing={8}>
      <Stack justifyContent="flex-start" width="100%">
        <Heading as="h1">Account Settings</Heading>
      </Stack>
      <Stack spacing={8}>
        <FormControl isReadOnly>
          <FormLabel fontWeight={600} color="whiteAlpha.700">
            Email
          </FormLabel>
          <Flex justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={4}>
            <Box>
              <Input isReadOnly value={data?.result.email || "(no email available)"} />
            </Box>
            <Button
              variant="link"
              color="blue.300"
              leftIcon={<RepeatIcon />}
              onClick={onClickGrantEmailAccess}
            >
              <span>Refresh Email</span>
            </Button>
          </Flex>
        </FormControl>
      </Stack>
      {data?.result.enableBilling && (
        <>
          <Divider />
          <Stack spacing={8}>
            <Stack>
              <Heading as="h2" size="md">
                Billing
              </Heading>
            </Stack>
            {!hasEmailAvailable && (
              <Alert status="warning" borderRadius="md" role={undefined}>
                <Stack>
                  <AlertTitle>
                    To enable billing for subscriptions, your email is required
                  </AlertTitle>
                  <AlertDescription>
                    <Button variant="solid" colorScheme="blue" onClick={onClickGrantEmailAccess}>
                      <span>Grant email access</span>
                    </Button>
                  </AlertDescription>
                </Stack>
              </Alert>
            )}
            {hasEmailAvailable && (
              <Stack>
                {data && (
                  <Stack spacing={8}>
                    {data.result.isOnPatreon && (
                      <Alert status="info" borderRadius="md" role={undefined}>
                        <Stack width="100%">
                          <AlertTitle>You are currently still on a legacy Patreon plan!</AlertTitle>
                          <AlertDescription>
                            <Text>
                              Subscriptions have moved off of Patreon. You are advised (but not
                              required) to move your pledge off of Patreon so that you may:
                            </Text>
                            <br />
                            <OrderedList>
                              <ListItem>
                                Optionally pay upfront for a year at a 15% discount
                              </ListItem>
                              <ListItem>Start your subscription on any day of the month</ListItem>
                              <ListItem>
                                Get localized pricing in your currency (there are now 14 more
                                currencies available)
                              </ListItem>
                              <ListItem>
                                Get credit that can be rolled over when changing plans, minimizing
                                your costs
                              </ListItem>
                              <ListItem>Manage your subscription on this control panel</ListItem>
                            </OrderedList>
                            <br />
                            <Text>
                              Be sure to manually cancel your Patreon pledge to avoid double
                              charges. To cancel your pledge, visit{" "}
                              <Link
                                href="https://www.patreon.com/monitorss"
                                target="_blank"
                                rel="noopener noreferrer"
                                color="blue.300"
                              >
                                Patreon
                              </Link>
                              .
                            </Text>
                            <Divider mt={4} mb={4} />
                            <Stack spacing={4}>
                              <Text fontWeight={600}>Frequently Asked Questions</Text>
                              <Accordion allowToggle>
                                <AccordionItem
                                  border="none"
                                  borderLeft={`solid 1px ${getChakraColor("blue.200")}`}
                                >
                                  <AccordionButton border="none">
                                    <Flex
                                      flex="1"
                                      gap={4}
                                      fontSize={13}
                                      color="blue.200"
                                      alignItems="center"
                                      textAlign="left"
                                    >
                                      Why are subscriptions moving off of Patreon?
                                      <AccordionIcon />
                                    </Flex>
                                  </AccordionButton>
                                  <AccordionPanel>
                                    <Text fontSize={13}>
                                      Patreon has very high fees, its API has had limitations that
                                      both disallowed yearly plans, prevented subscriptions from
                                      starting on any day of the month, and made tax compliance
                                      difficult. While it has worked well enough in the past, it is
                                      not viable for sustaining the public service that MonitoRSS
                                      provides in the long run.
                                    </Text>
                                  </AccordionPanel>
                                </AccordionItem>
                                <AccordionItem
                                  border="none"
                                  borderLeft={`solid 1px ${getChakraColor("blue.200")}`}
                                >
                                  <AccordionButton border="none">
                                    <Flex
                                      flex="1"
                                      gap={4}
                                      fontSize={13}
                                      color="blue.200"
                                      alignItems="center"
                                      textAlign="left"
                                    >
                                      Has pricing changed?
                                      <AccordionIcon />
                                    </Flex>
                                  </AccordionButton>
                                  <AccordionPanel>
                                    <Text fontSize={13}>
                                      In a way, yes. Unfortunately, the original Patreon tiers 1 and
                                      2 are no longer available due to the disproportionate load
                                      they place on the bot when compared to the revenue they
                                      generate. As a result, they have been discontinued to ensure
                                      that MonitoRSS can continue to be hosted for free.
                                      <br />
                                      <br /> On the upside, yearly plans are now available at a 15%
                                      discount, and there are a total of 30 currencies that are now
                                      supported (instead of just 16 on Patreon).
                                    </Text>
                                  </AccordionPanel>
                                </AccordionItem>
                                <AccordionItem
                                  border="none"
                                  borderLeft={`solid 1px ${getChakraColor("blue.200")}`}
                                >
                                  <AccordionButton border="none">
                                    <Flex
                                      flex="1"
                                      gap={4}
                                      fontSize={13}
                                      color="blue.200"
                                      alignItems="center"
                                      textAlign="left"
                                    >
                                      Why does it say I&apos;m on the free plan if I&apos;m on
                                      Patreon?
                                      <AccordionIcon />
                                    </Flex>
                                  </AccordionButton>
                                  <AccordionPanel>
                                    <Text fontSize={13}>
                                      If you are still on Patreon, you are technically not on the
                                      new billing model and thus is a free user. You can continue
                                      referencing Patreon for your pledge status, but you will not
                                      be able to manage or view your pledge on this control panel.
                                    </Text>
                                  </AccordionPanel>
                                </AccordionItem>
                              </Accordion>
                            </Stack>
                          </AlertDescription>
                        </Stack>
                      </Alert>
                    )}
                    {data.result.subscription.product.key !== ProductKey.Free && (
                      <Stack>
                        <Text as="h3" fontWeight={600} color="whiteAlpha.700">
                          Credit Balance
                        </Text>
                        <Text>
                          Credit is provided as pro-rata refunds when changing plans. It is
                          automatically applied on future transactions.
                        </Text>
                        <Stack spacing={3}>
                          <Text fontSize="xl" fontWeight="semibold">
                            {data.result.creditBalance.availableFormatted}
                          </Text>
                        </Stack>
                      </Stack>
                    )}
                    <Stack>
                      <Text as="h3" fontWeight={600} color="whiteAlpha.700">
                        Current Tier
                      </Text>
                      <Stack spacing={3}>
                        {subscriptionText}
                        <HStack flexWrap="wrap">
                          {subscriptionPendingCancellation && (
                            <Box>
                              <ConfirmModal
                                trigger={
                                  <Button size="sm" variant="solid" colorScheme="blue">
                                    <span>Resume subscription</span>
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
                            <Button size="sm" onClick={onOpenPricingDialog}>
                              <span>Manage Subscription</span>
                            </Button>
                          )}
                          <PageAlertProvider>
                            {!subscriptionPendingCancellation && <ChangePaymentMethodUrlButton />}
                            <PageAlertContextOutlet />
                          </PageAlertProvider>
                        </HStack>
                      </Stack>
                    </Stack>
                  </Stack>
                )}
              </Stack>
            )}
          </Stack>
        </>
      )}
      <Divider />
      <Stack spacing={6}>
        <Heading as="h2" size="md">
          Integrations
        </Heading>
        <HStack
          justifyContent="space-between"
          borderStyle="solid"
          alignItems="flex-start"
          borderWidth={1}
          borderColor="gray.700"
          rounded="md"
          p={4}
          gap={4}
          flexWrap="wrap"
        >
          <Stack>
            <Stack spacing={1}>
              <HStack alignItems="center" gap={2}>
                <Text fontWeight={600}>Reddit</Text>
                {redditConnected && <Badge colorScheme="green">Connected</Badge>}
                {!redditConnected && <Badge>Not Connected</Badge>}
              </HStack>
              <Text color="whiteAlpha.600" fontSize="sm">
                Allows MonitoRSS to use rate limits specific to your Reddit account, which has much
                higher rate limit quotas than the global rate limits. All Reddit feeds will
                automatically use your Reddit account if connected.
              </Text>
            </Stack>
          </Stack>
          <HStack>
            <RedditLoginButton />
            {redditConnected && (
              <Button
                colorScheme="red"
                variant="ghost"
                size="sm"
                isLoading={removeRedditLoginStatus === "loading"}
                onClick={() => {
                  onClickRemoveRedditLogin();
                }}
              >
                <span>Disconnect</span>
              </Button>
            )}
          </HStack>
        </HStack>
      </Stack>
      <Divider />
      <FormProvider {...formMethods}>
        <form onSubmit={handleSubmit(onSubmit)}>
          <Stack spacing={6}>
            <Heading as="h2" size="md" id="preferences-title">
              Preferences
            </Heading>
            <Stack spacing={12}>
              <Stack spacing={4}>
                <Heading as="h3" size="sm" id="notifications">
                  Notifications
                </Heading>
                {!hasEmailAvailable && (
                  <Alert status="warning" borderRadius="md" role={undefined}>
                    <Stack>
                      <AlertTitle>To enable notifications, your email is required</AlertTitle>
                      <AlertDescription>
                        <Button
                          variant="solid"
                          colorScheme="blue"
                          onClick={onClickGrantEmailAccess}
                        >
                          <span>Grant email access</span>
                        </Button>
                      </AlertDescription>
                    </Stack>
                  </Alert>
                )}
                <Box role="list" aria-labelledby="notifications preferences-title">
                  {hasEmailAvailable && (
                    <Stack spacing={4} role="listitem">
                      <FormControl as={Flex} justifyContent="space-between" flexWrap="wrap" gap={4}>
                        <Box>
                          <FormLabel>Disabled feed or feed connections</FormLabel>
                          <FormHelperText>
                            Whenever feed or feed connections automatically get disabled due to
                            issues while processing.
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
                    </Stack>
                  )}
                </Box>
              </Stack>
              <Stack spacing={4}>
                <Stack mb={2}>
                  <Heading as="h3" size="sm" id="date-preferences">
                    Date Placeholders
                  </Heading>
                  <Text>
                    Customize the format, locale, and timezone used for date placeholders across all
                    feeds.
                  </Text>
                </Stack>
                <fieldset aria-labelledby="date-preferences preferences-title">
                  <Controller
                    name="dates"
                    control={control}
                    render={({ field }) => {
                      return (
                        <DatePreferencesForm
                          errors={{
                            timezone: errors.dates?.timezone?.message,
                          }}
                          onChange={(values) => {
                            field.onChange({
                              format: values.format,
                              locale: values.locale,
                              timezone: values.timezone,
                            });
                          }}
                          values={{
                            format: field.value?.format,
                            locale: field.value?.locale,
                            timezone: field.value?.timezone,
                          }}
                        />
                      );
                    }}
                  />
                </fieldset>
              </Stack>
            </Stack>
          </Stack>
          <SavedUnsavedChangesPopupBar />
        </form>
      </FormProvider>
    </Stack>
  );
};
