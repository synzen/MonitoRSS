import { yupResolver } from "@hookform/resolvers/yup";
import { Box, Button, HStack, RadioGroup as ChakraRadioGroup, Stack, Text } from "@chakra-ui/react";
import { Controller, useForm } from "react-hook-form";
import React, { useContext, useEffect, useState } from "react";
import { InferType, array, number, object, string } from "yup";
import { InlineErrorAlert, PrimaryActionButton } from "@/components";
import { PricingDialogContext } from "@/features/subscriptionProducts";
import ApiAdapterError from "@/utils/ApiAdapterError";
import {
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
} from "@/components/ui/dialog";
import { NumberInputRoot, NumberInputField } from "@/components/ui/number-input";
import { FeedScheduleSettings } from "../FeedScheduleSettings";
import { UpdateUserFeedInput } from "../../api";
import { UserFeed } from "../../types";
import { Field } from "@/components/ui/field";
import {
  ALL_SCHEDULE_DAYS,
  MAX_SCHEDULE_TIMES,
  SCHEDULE_TIME_PATTERN,
  browserTimezone,
  getNextScheduledFetchText,
  isEveryDay,
  isTimezoneValue,
} from "@/utils/feedSchedule";
import { getEffectiveRefreshRateSeconds } from "@/utils/formatRefreshRateSeconds";

const FormSchema = object({
  scheduleMode: string().oneOf(["interval", "scheduled"]).default("interval"),
  scheduleTimes: array(
    string().required("Choose a time").matches(SCHEDULE_TIME_PATTERN, "Enter a valid time"),
  ).when("scheduleMode", {
    is: "scheduled",
    then: (schema) =>
      schema
        .min(1, "Add at least one delivery time")
        .max(MAX_SCHEDULE_TIMES, `Up to ${MAX_SCHEDULE_TIMES} times per day`),
    otherwise: (schema) => schema.notRequired(),
  }),
  scheduleTimezone: string().when("scheduleMode", {
    is: "scheduled",
    then: (schema) =>
      schema
        .required("Choose a timezone")
        .test("is-timezone", "Must be a valid timezone", isTimezoneValue),
    otherwise: (schema) => schema.notRequired(),
  }),
  scheduleDays: array(number().oneOf(ALL_SCHEDULE_DAYS, "Invalid day").required()).when(
    "scheduleMode",
    {
      is: "scheduled",
      then: (schema) => schema.min(1, "Choose at least one day"),
      otherwise: (schema) => schema.notRequired(),
    },
  ),
  userRefreshRateMinutes: string().when("scheduleMode", {
    is: "interval",
    then: (schema) =>
      schema
        .required("Enter a refresh rate")
        .test("is-positive-number", "Enter a refresh rate greater than 0", (value) => {
          const minutes = Number(value);

          return Number.isFinite(minutes) && minutes > 0;
        }),
    otherwise: (schema) => schema.notRequired(),
  }),
});

type FormValues = InferType<typeof FormSchema>;

// Rates without a disabledCode are the ones the user's plan allows; locked
// rates are marked INSUFFICIENT_SUPPORTER_TIER.
const getFastestAllowedRateSeconds = (feed: UserFeed) => {
  const rates = feed.refreshRateOptions
    .filter((option) => !option.disabledCode)
    .map((option) => option.rateSeconds);

  return rates.length ? Math.min(...rates) : undefined;
};

const getCanUpgradeRefreshRate = (feed: UserFeed) =>
  feed.refreshRateOptions.some((option) => option.disabledCode === "INSUFFICIENT_SUPPORTER_TIER");

const defaultValues = (feed: UserFeed): FormValues => ({
  scheduleMode: feed.scheduleMode === "scheduled" ? "scheduled" : "interval",
  scheduleTimes: feed.schedule?.times?.length ? feed.schedule.times : ["09:00"],
  scheduleTimezone: feed.schedule?.timezone || browserTimezone(),
  // Absent days on the feed means every day.
  scheduleDays:
    feed.schedule?.days && !isEveryDay(feed.schedule.days) ? feed.schedule.days : ALL_SCHEDULE_DAYS,
  userRefreshRateMinutes: (getEffectiveRefreshRateSeconds(feed) / 60).toFixed(1),
});

interface ModeCardProps {
  value: string;
  title: string;
  description: string;
  selected: boolean;
  children?: React.ReactNode;
}

// The click target is ONLY the header (radio + title + description). The
// config panel is a sibling of the RadioGroup.Item label, never a descendant —
// interactive controls must not be nested inside a clickable radio/label.
const ModeCard = ({ value, title, description, selected, children }: ModeCardProps) => (
  <Box
    borderWidth="1px"
    borderColor={selected ? "brand.solid" : "border"}
    borderRadius="l2"
    bg={selected ? "bg.subtle" : "transparent"}
    overflow="hidden"
  >
    <ChakraRadioGroup.Item
      value={value}
      width="full"
      px={4}
      py={4}
      gap={3}
      cursor="pointer"
      _hover={selected ? undefined : { bg: "bg.subtle" }}
      // fg-colored ring inset past the border edge: a brand-colored ring hugging
      // the brand-colored border would fail focus-visible contrast.
      _focusWithin={{ outline: "2px solid", outlineColor: "fg", outlineOffset: "-6px" }}
    >
      <ChakraRadioGroup.ItemHiddenInput />
      <ChakraRadioGroup.ItemIndicator mt={1} />
      <Stack gap={0.5}>
        <ChakraRadioGroup.ItemText fontWeight="medium">{title}</ChakraRadioGroup.ItemText>
        <Text fontSize="sm" color="fg.muted">
          {description}
        </Text>
      </Stack>
    </ChakraRadioGroup.Item>
    {selected && children && (
      <Box px={4} pb={4} pt={3} borderTopWidth="1px" borderTopColor="border">
        {children}
      </Box>
    )}
  </Box>
);

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCloseRef?: React.RefObject<HTMLButtonElement>;
  feed: UserFeed;
  onUpdate: (data: UpdateUserFeedInput["data"]) => Promise<void>;
}

interface SubmitError {
  message: string;
  /**
   * True when the requested rate is faster than the user's plan allows and a
   * paid tier exists that unlocks lower rates.
   */
  canUpgrade: boolean;
}

export const EditDeliveryScheduleDialog: React.FC<Props> = ({
  isOpen,
  onClose,
  onCloseRef,
  feed,
  onUpdate,
}) => {
  const {
    handleSubmit,
    control,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: yupResolver(FormSchema),
    defaultValues: defaultValues(feed),
  });
  const [submitError, setSubmitError] = useState<SubmitError | null>(null);
  const { onOpen: onOpenPricingDialog } = useContext(PricingDialogContext);

  useEffect(() => {
    if (isOpen) {
      reset(defaultValues(feed));
      setSubmitError(null);
    }
  }, [isOpen]);

  const scheduleMode = watch("scheduleMode");
  const scheduleTimes = watch("scheduleTimes");
  const scheduleTimezone = watch("scheduleTimezone");
  const scheduleDays = watch("scheduleDays");

  const nextFetchText =
    scheduleMode === "scheduled" && scheduleTimezone
      ? getNextScheduledFetchText(scheduleTimes ?? [], scheduleTimezone, scheduleDays ?? [])
      : null;

  const timesErrors = errors.scheduleTimes as
    | { message?: string }
    | Array<{ message?: string } | undefined>
    | undefined;
  const timesListError = !Array.isArray(timesErrors) ? timesErrors?.message : undefined;
  const timesRowErrors = Array.isArray(timesErrors)
    ? timesErrors.map((e) => e?.message)
    : undefined;

  const onSubmit = async (values: FormValues) => {
    setSubmitError(null);

    try {
      if (values.scheduleMode === "scheduled") {
        const times = [
          ...new Set(
            (values.scheduleTimes || []).filter((time) => SCHEDULE_TIME_PATTERN.test(time)),
          ),
        ].sort();

        if (!times.length) {
          setSubmitError({
            message: "Add at least one valid delivery time.",
            canUpgrade: false,
          });

          return;
        }

        // All seven days is the canonical "every day" form, sent without the
        // days field.
        await onUpdate({
          scheduleMode: "scheduled",
          schedule: {
            times,
            timezone: values.scheduleTimezone || browserTimezone(),
            ...(values.scheduleDays?.length === 7
              ? {}
              : { days: [...new Set(values.scheduleDays || [])].sort((a, b) => a - b) }),
          },
        });
      } else {
        const minutes = Number(values.userRefreshRateMinutes);

        await onUpdate({
          scheduleMode: "interval",
          userRefreshRateSeconds:
            Number.isFinite(minutes) && minutes > 0 ? minutes * 60 : undefined,
        });
      }

      onClose();
    } catch (err) {
      if (err instanceof ApiAdapterError && err.errorCode === "USER_REFRESH_RATE_NOT_ALLOWED") {
        const fastestAllowedRateSeconds = getFastestAllowedRateSeconds(feed);

        setSubmitError({
          message:
            fastestAllowedRateSeconds !== undefined
              ? `Your current plan only allows checking this feed once every ${(
                  fastestAllowedRateSeconds / 60
                ).toFixed(1)} minutes or more.`
              : "The selected refresh rate is not allowed for your current plan.",
          canUpgrade: getCanUpgradeRefreshRate(feed),
        });
      } else {
        setSubmitError({
          message: err instanceof Error ? err.message : "Something went wrong. Please try again.",
          canUpgrade: false,
        });
      }
    }
  };

  return (
    <DialogRoot
      open={isOpen}
      onOpenChange={(e) => {
        if (!e.open) {
          onClose();
        }
      }}
      finalFocusEl={() => onCloseRef?.current ?? null}
      size="lg"
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit delivery schedule</DialogTitle>
        </DialogHeader>
        <DialogCloseTrigger />
        <DialogBody>
          <Stack gap={5}>
            <Stack gap={2}>
              <Text fontSize="sm" fontWeight="medium">
                Delivery mode
              </Text>
              <ChakraRadioGroup.Root
                name="delivery-schedule-mode"
                value={scheduleMode}
                onValueChange={(details) =>
                  setValue("scheduleMode", details.value as FormValues["scheduleMode"], {
                    shouldDirty: true,
                  })
                }
                display="flex"
                flexDirection="column"
                gap={3}
                alignItems="stretch"
                aria-label="Delivery mode"
              >
                <ModeCard
                  value="interval"
                  selected={scheduleMode === "interval"}
                  title="Check automatically"
                  description="Checked at a fixed interval; articles delivered as they are found."
                >
                  <Controller
                    name="userRefreshRateMinutes"
                    control={control}
                    render={({ field }) => {
                      const fastestAllowedRateSeconds = getFastestAllowedRateSeconds(feed);

                      return (
                        <Field
                          invalid={!!errors.userRefreshRateMinutes}
                          errorText={errors.userRefreshRateMinutes?.message}
                        >
                          <Text fontSize="sm" fontWeight="medium">
                            Refresh rate
                          </Text>
                          <HStack gap={3}>
                            <NumberInputRoot
                              step={0.1}
                              allowMouseWheel
                              value={field.value}
                              onValueChange={(details) => field.onChange(details.value)}
                              onBlur={() => field.onBlur()}
                              name={field.name}
                              ref={field.ref}
                            >
                              <NumberInputField width="130px" />
                            </NumberInputRoot>
                            <Text>minutes</Text>
                          </HStack>
                          {fastestAllowedRateSeconds !== undefined &&
                            !errors.userRefreshRateMinutes && (
                              <Text fontSize="sm" color="fg.muted">
                                Your plan allows checking as often as every{" "}
                                {(fastestAllowedRateSeconds / 60).toFixed(1)} minutes.
                                {getCanUpgradeRefreshRate(feed) &&
                                  " Lower rates are available on paid plans."}
                              </Text>
                            )}
                        </Field>
                      );
                    }}
                  />
                </ModeCard>
                <ModeCard
                  value="scheduled"
                  selected={scheduleMode === "scheduled"}
                  title="At scheduled times"
                  description="Delivered once at each time you pick, e.g. every weekday at 09:00. Your interval is kept and applies again if you switch back."
                >
                  <Controller
                    key="schedule-times"
                    name="scheduleTimes"
                    control={control}
                    render={({ field }) => (
                      <FeedScheduleSettings
                        times={field.value ?? []}
                        onTimesChange={field.onChange}
                        timeErrors={timesRowErrors}
                        timesListError={timesListError}
                        days={scheduleDays ?? ALL_SCHEDULE_DAYS}
                        onDaysChange={(days) =>
                          setValue("scheduleDays", days, { shouldDirty: true })
                        }
                        daysError={errors.scheduleDays?.message}
                        timezone={scheduleTimezone || browserTimezone()}
                        onTimezoneChange={(tz) =>
                          setValue("scheduleTimezone", tz, { shouldDirty: true })
                        }
                        timezoneError={errors.scheduleTimezone?.message}
                        hideNextFetchPreview
                      />
                    )}
                  />
                </ModeCard>
              </ChakraRadioGroup.Root>
            </Stack>
            {submitError && (
              <InlineErrorAlert
                title="Failed to update the delivery schedule"
                description={
                  <Stack gap={3} alignItems="flex-start">
                    <Text>{submitError.message}</Text>
                    {submitError.canUpgrade && (
                      <Button size="sm" onClick={() => onOpenPricingDialog()}>
                        Upgrade for faster refresh rates
                      </Button>
                    )}
                  </Stack>
                }
              />
            )}
          </Stack>
        </DialogBody>
        <DialogFooter justifyContent="space-between" alignItems="center" gap={4}>
          <Box aria-live="polite" minWidth={0}>
            {nextFetchText && (
              <Text fontSize="sm" color="fg.muted">
                {nextFetchText}
              </Text>
            )}
          </Box>
          <HStack gap={3}>
            <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
              <span>Cancel</span>
            </Button>
            <PrimaryActionButton
              loading={isSubmitting}
              loadingText="Saving"
              onClick={() => handleSubmit(onSubmit)()}
            >
              <span>Save</span>
            </PrimaryActionButton>
          </HStack>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
};
