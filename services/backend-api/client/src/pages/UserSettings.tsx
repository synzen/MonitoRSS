import {
  Box,
  Button,
  Flex,
  HStack,
  Heading,
  Input,
  Link,
  List,
  Separator,
  Stack,
  Text,
  chakra,
} from "@chakra-ui/react";
import { FaArrowsRotate } from "react-icons/fa6";
import { InferType, bool, object, string } from "yup";
import { yupResolver } from "@hookform/resolvers/yup";
import { Controller, FormProvider, useForm } from "react-hook-form";
import { useContext, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import dayjs from "dayjs";
import { captureException } from "@sentry/react";
import { GetUserMeOutput, useUpdateUserMe, useUserMe } from "../features/discordUser";
import {
  BoxConstrained,
  ConfirmModal,
  DashboardContentV2,
  SavedUnsavedChangesPopupBar,
  SettingsSection,
} from "../components";
import { PrimaryActionButton } from "@/components/PrimaryActionButton";
import { SafeLoadingButton } from "@/components/SafeLoadingButton";
import { useLogin } from "../hooks";
import { useCreateSubscriptionResume } from "../features/subscriptionProducts/hooks/useCreateSubscriptionResume";
import { ProductKey } from "../constants";

import { useGetUpdatePaymentMethodTransaction } from "../features/subscriptionProducts";
import { PricingDialogContext, usePaddleContext } from "@/features/subscriptionProducts";
import { DatePreferencesForm, RedditConnectionSetting } from "@/features/feed";
import {
  VerifiedEmailSettingsRow,
  WorkspacesSettingsSection,
  useIsWorkspacesEnabled,
} from "@/features/workspaces";
import {
  PageAlertContextOutlet,
  PageAlertProvider,
  usePageAlertContext,
} from "../contexts/PageAlertContext";
import {
  AccordionRoot,
  AccordionItem,
  AccordionItemTrigger,
  AccordionItemContent,
} from "@/components/ui/accordion";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";

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
      <SafeLoadingButton
        size="sm"
        variant="outline"
        loading={fetchStatus === "fetching"}
        onClick={() => {
          if (error) {
            return;
          }

          onClick();
        }}
        aria-disabled={!!error}
        colorPalette={error ? "red" : undefined}
      >
        <span>
          {error ? "Failed to load change payment method button" : "Change Payment Method"}
        </span>
      </SafeLoadingButton>
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
            <BoxConstrained.Container paddingTop={4} gap={6} paddingBottom={120}>
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
  const formFocusRef = useRef<HTMLFormElement>(null);
  const { createSuccessAlert, createErrorAlert } = usePageAlertContext();
  const { enabled: workspacesEnabled } = useIsWorkspacesEnabled();
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

  const isPastDue = subscription?.status === "PAST_DUE";

  return (
    <Stack gap={10}>
      <Stack justifyContent="flex-start" width="100%">
        <Heading as="h1">Account Settings</Heading>
      </Stack>
      <SettingsSection
        title="Email"
        description={
          workspacesEnabled
            ? "Your Discord email is used for billing receipts and notifications. Your verified email is used for workspace invitations, and for member notices when it is set. Member notices fall back to your Discord email if you have not verified one."
            : "The email tied to your Discord account, used for notifications and billing receipts."
        }
      >
        <Stack gap={6}>
          <Field
            label={workspacesEnabled ? "Discord email" : undefined}
            helperText={
              workspacesEnabled
                ? "Sourced from your Discord account. Refresh it if it has changed there."
                : undefined
            }
          >
            <HStack gap={2} alignSelf="stretch" alignItems="center">
              <Input
                aria-label="Email"
                flex="1"
                readOnly
                value={data?.result.email || "(no email available)"}
              />
              <Button variant="plain" color="text.link" onClick={onClickGrantEmailAccess}>
                <FaArrowsRotate />
                <span>Refresh Email</span>
              </Button>
            </HStack>
          </Field>
          <VerifiedEmailSettingsRow
            onChanged={() => createSuccessAlert({ title: "Your verified email has been updated." })}
          />
        </Stack>
      </SettingsSection>
      {data?.result.enableBilling && (
        <>
          <Separator />
          <SettingsSection
            title="Billing"
            description="Your personal subscription plan, credit balance, and payment method."
          >
            {!hasEmailAvailable && (
              <Alert
                status="warning"
                role={undefined}
                title="To enable billing for subscriptions, your email is required"
              >
                <PrimaryActionButton variant="solid" onClick={onClickGrantEmailAccess}>
                  <span>Grant email access</span>
                </PrimaryActionButton>
              </Alert>
            )}
            {hasEmailAvailable && (
              <Stack>
                {data && (
                  <Stack gap={8}>
                    {data.result.isOnPatreon && (
                      <Alert
                        status="info"
                        role={undefined}
                        title="You are currently still on a legacy Patreon plan!"
                      >
                        <Stack width="100%">
                          <Text>
                            Subscriptions have moved off of Patreon. You are advised (but not
                            required) to move your pledge off of Patreon so that you may:
                          </Text>
                          <br />
                          <List.Root as="ol">
                            <List.Item>
                              Optionally pay upfront for a year at a 15% discount
                            </List.Item>
                            <List.Item>Start your subscription on any day of the month</List.Item>
                            <List.Item>
                              Get localized pricing in your currency (there are now 14 more
                              currencies available)
                            </List.Item>
                            <List.Item>
                              Get credit that can be rolled over when changing plans, minimizing
                              your costs
                            </List.Item>
                            <List.Item>Manage your subscription on this control panel</List.Item>
                          </List.Root>
                          <br />
                          <Text>
                            Be sure to manually cancel your Patreon pledge to avoid double charges.
                            To cancel your pledge, visit{" "}
                            <Link
                              href="https://www.patreon.com/monitorss"
                              target="_blank"
                              rel="noopener noreferrer"
                              color="text.link"
                            >
                              Patreon
                            </Link>
                            .
                          </Text>
                          <Separator mt={4} mb={4} />
                          <Stack gap={4}>
                            <Text fontWeight={600}>Frequently Asked Questions</Text>
                            <AccordionRoot collapsible>
                              <AccordionItem
                                value="why-moving"
                                border="none"
                                borderLeft="solid 1px var(--app-accent-solid)"
                              >
                                <AccordionItemTrigger>
                                  <Flex
                                    flex="1"
                                    gap={4}
                                    fontSize={13}
                                    color="text.link"
                                    alignItems="center"
                                    textAlign="left"
                                  >
                                    Why are subscriptions moving off of Patreon?
                                  </Flex>
                                </AccordionItemTrigger>
                                <AccordionItemContent>
                                  <Text fontSize={13}>
                                    Patreon has very high fees, its API has had limitations that
                                    both disallowed yearly plans, prevented subscriptions from
                                    starting on any day of the month, and made tax compliance
                                    difficult. While it has worked well enough in the past, it is
                                    not viable for sustaining the public service that MonitoRSS
                                    provides in the long run.
                                  </Text>
                                </AccordionItemContent>
                              </AccordionItem>
                              <AccordionItem
                                value="pricing-changed"
                                border="none"
                                borderLeft="solid 1px var(--app-accent-solid)"
                              >
                                <AccordionItemTrigger>
                                  <Flex
                                    flex="1"
                                    gap={4}
                                    fontSize={13}
                                    color="text.link"
                                    alignItems="center"
                                    textAlign="left"
                                  >
                                    Has pricing changed?
                                  </Flex>
                                </AccordionItemTrigger>
                                <AccordionItemContent>
                                  <Text fontSize={13}>
                                    In a way, yes. Unfortunately, the original Patreon tiers 1 and 2
                                    are no longer available due to the disproportionate load they
                                    place on the bot when compared to the revenue they generate. As
                                    a result, they have been discontinued to ensure that MonitoRSS
                                    can continue to be hosted for free.
                                    <br />
                                    <br /> On the upside, yearly plans are now available at a 15%
                                    discount, and there are a total of 30 currencies that are now
                                    supported (instead of just 16 on Patreon).
                                  </Text>
                                </AccordionItemContent>
                              </AccordionItem>
                              <AccordionItem
                                value="free-plan"
                                border="none"
                                borderLeft="solid 1px var(--app-accent-solid)"
                              >
                                <AccordionItemTrigger>
                                  <Flex
                                    flex="1"
                                    gap={4}
                                    fontSize={13}
                                    color="text.link"
                                    alignItems="center"
                                    textAlign="left"
                                  >
                                    Why does it say I&apos;m on the free plan if I&apos;m on
                                    Patreon?
                                  </Flex>
                                </AccordionItemTrigger>
                                <AccordionItemContent>
                                  <Text fontSize={13}>
                                    If you are still on Patreon, you are technically not on the new
                                    billing model and thus is a free user. You can continue
                                    referencing Patreon for your pledge status, but you will not be
                                    able to manage or view your pledge on this control panel.
                                  </Text>
                                </AccordionItemContent>
                              </AccordionItem>
                            </AccordionRoot>
                          </Stack>
                        </Stack>
                      </Alert>
                    )}
                    {data.result.subscription.product.key !== ProductKey.Free && (
                      <Stack>
                        <Text as="h3" fontWeight={600} color="fg.muted">
                          Credit Balance
                        </Text>
                        <Text>
                          Credit is provided as pro-rata refunds when changing plans. It is
                          automatically applied on future transactions.
                        </Text>
                        <Stack gap={3}>
                          <Text fontSize="xl" fontWeight="semibold">
                            {data.result.creditBalance.availableFormatted}
                          </Text>
                        </Stack>
                      </Stack>
                    )}
                    <Stack>
                      <Text as="h3" fontWeight={600} color="fg.muted">
                        Current Tier
                      </Text>
                      <Stack gap={3}>
                        {subscriptionText}
                        {isPastDue && subscription?.pastDueGracePeriodEndDate && (
                          <Alert status="warning" title="Your payment is past due">
                            <Text>
                              Benefits will be suspended on{" "}
                              <chakra.span fontWeight={600}>
                                {new Date(
                                  subscription.pastDueGracePeriodEndDate,
                                ).toLocaleDateString(undefined, {
                                  year: "numeric",
                                  month: "long",
                                  day: "numeric",
                                })}
                              </chakra.span>{" "}
                              unless payment is updated. Please check your email for further
                              instructions.
                            </Text>
                            <Box mt={3}>
                              <PageAlertProvider>
                                <ChangePaymentMethodUrlButton />
                                <PageAlertContextOutlet />
                              </PageAlertProvider>
                            </Box>
                          </Alert>
                        )}
                        <HStack flexWrap="wrap">
                          {subscriptionPendingCancellation && (
                            <Box>
                              <ConfirmModal
                                trigger={
                                  <PrimaryActionButton size="sm" variant="solid">
                                    <span>Resume subscription</span>
                                  </PrimaryActionButton>
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
          </SettingsSection>
        </>
      )}
      <Separator />
      <SettingsSection
        title="Integrations"
        description="Third-party connections that your personal feeds fetch with."
      >
        <RedditConnectionSetting
          onRemoveSuccess={() =>
            createSuccessAlert({
              title: "Successfully removed Reddit login.",
            })
          }
          onRemoveError={(description) =>
            createErrorAlert({
              title: "Failed to remove Reddit login.",
              description,
            })
          }
        />
      </SettingsSection>
      <WorkspacesSettingsSection />
      <Separator />
      <FormProvider {...formMethods}>
        <form onSubmit={handleSubmit(onSubmit)} ref={formFocusRef} aria-label="Account settings">
          <Stack gap={10}>
            <SettingsSection
              title="Notifications"
              headingId="notifications"
              description="Emails about events that affect your feeds."
            >
              {!hasEmailAvailable && (
                <Alert
                  status="warning"
                  role={undefined}
                  title="To enable notifications, your email is required"
                >
                  <PrimaryActionButton variant="solid" onClick={onClickGrantEmailAccess}>
                    <span>Grant email access</span>
                  </PrimaryActionButton>
                </Alert>
              )}
              <Box role="list" aria-labelledby="notifications">
                {hasEmailAvailable && (
                  <Stack gap={4} role="listitem">
                    <Flex as="div" justifyContent="space-between" flexWrap="wrap" gap={4}>
                      <Box>
                        <Field
                          label="Disabled feed or feed connections"
                          helperText="Whenever feed or feed connections automatically get disabled due to issues while processing."
                        />
                      </Box>
                      <Controller
                        name="alertOnDisabledFeeds"
                        control={control}
                        render={({ field }) => {
                          return (
                            <Switch
                              size="lg"
                              disabled={!hasLoaded || !hasEmailAvailable || isSubmitting}
                              checked={!!field.value}
                              onCheckedChange={(e) => field.onChange(e.checked)}
                            />
                          );
                        }}
                      />
                    </Flex>
                  </Stack>
                )}
              </Box>
            </SettingsSection>
            <Separator />
            <SettingsSection
              title="Date Placeholders"
              headingId="date-preferences"
              description="Customize the format, locale, and timezone used for date placeholders across all feeds."
            >
              <fieldset aria-labelledby="date-preferences">
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
            </SettingsSection>
          </Stack>
          <SavedUnsavedChangesPopupBar restoreFocusRef={formFocusRef} />
        </form>
      </FormProvider>
    </Stack>
  );
};
