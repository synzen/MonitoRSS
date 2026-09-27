import {
  Box,
  Button,
  Center,
  Code,
  Separator,
  HStack,
  IconButton,
  Input,
  Link as ChakraLink,
  Skeleton,
  Stack,
  TableBody,
  TableCell,
  TableColumnHeader,
  TableHeader,
  TableRoot,
  TableRow,
  TableScrollArea,
  Text,
  Heading,
} from "@chakra-ui/react";
import { Link as RouterLink } from "react-router-dom";
import { yupResolver } from "@hookform/resolvers/yup";
import dayjs from "dayjs";
import { Controller, FormProvider, useForm } from "react-hook-form";
import { Trans, useTranslation } from "react-i18next";
import { array, InferType, number, object, string } from "yup";
import { FaChevronDown, FaTrash, FaUpRightFromSquare, FaGear } from "react-icons/fa6";
import { useState, useRef } from "react";
import { ConfirmModal, InlineErrorAlert, Loading, SavedUnsavedChangesPopupBar } from "@/components";
import {
  useCreateUserFeedManagementInvite,
  useDeleteUserFeedManagementInvite,
  useUpdateUserFeed,
  useUserFeed,
  useFeedScope,
} from "@/features/feed";
import { DiscordUsername, useDiscordUserMe } from "@/features/discordUser";
import { pages, UserFeedManagerInviteType, UserFeedManagerStatus } from "@/constants";
import { ResendUserFeedManagementInviteButton } from "./ResendUserFeedManagementInviteButton";
import { SelectUserDialog } from "./SelectUserDialog";
import DATE_LOCALES from "@/constants/dateLocales";
import { useUserFeedDatePreview } from "../../../../../feed/hooks/useUserFeedDatePreview";
import { useDebounce } from "@/hooks";
import { ManageUserFeedManagementInviteSettingsDialog } from "./ManageUserFeedManagementInviteSettingsDialog";
import { AddFeedComanagerDialog } from "./AddFeedComanagerDialog";
import {
  PageAlertContextOutlet,
  PageAlertProvider,
  usePageAlertContext,
} from "@/contexts/PageAlertContext";
import { UserFeedTabSearchParam } from "@/constants/userFeedTabSearchParam";
import ApiAdapterError from "@/utils/ApiAdapterError";
import { getEffectiveRefreshRateSeconds } from "@/utils/formatRefreshRateSeconds";
import { browserTimezone, isEveryDay, MAX_SCHEDULE_TIMES, SCHEDULE_TIME_PATTERN, ALL_SCHEDULE_DAYS } from "@/utils/feedSchedule";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/ui/field";
import { MenuRoot, MenuTrigger, MenuContent, MenuItem } from "@/components/ui/menu";
import { NumberInputRoot, NumberInputField } from "@/components/ui/number-input";
import { NativeSelectRoot, NativeSelectField } from "@/components/ui/native-select";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Tag } from "@/components/ui/tag";
import { FeedScheduleSettings } from "@/features/feed/components/FeedScheduleSettings";

interface Props {
  feedId: string;
}

const SCHEDULE_DEFAULT_TIME = "09:00";

const isTimezoneValue = (val: string | undefined) => {
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
};

const FormSchema = object({
  dateFormat: string().optional(),
  dateTimezone: string().test("is-timezone", "Must be a valid timezone", isTimezoneValue),
  dateLocale: string().optional(),
  oldArticleDateDiffMsThreshold: number().optional(),
  shareManageOptions: object({
    invites: array(
      object({
        discordUserId: string().required(),
      }).required(),
    ).required(),
  })
    .optional()
    .nullable()
    .default(null),
  userRefreshRateMinutes: string().optional(),
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
  scheduleDays: array(
    number().oneOf(ALL_SCHEDULE_DAYS, "Invalid day").required(),
  ).when("scheduleMode", {
    is: "scheduled",
    then: (schema) => schema.min(1, "Choose at least one day"),
    otherwise: (schema) => schema.notRequired(),
  }),
});

type FormValues = InferType<typeof FormSchema>;

export const UserFeedMiscSettingsTabSection = ({ feedId }: Props) => {
  const { t } = useTranslation();
  const { workspaceSlug } = useFeedScope();
  const {
    status: feedStatus,
    feed,
    error: feedError,
  } = useUserFeed({
    feedId,
  });
  const { data: user } = useDiscordUserMe();
  const [manageInviteDialogState, setManageInviteDialogState] = useState<{
    isOpen: boolean;
    inviteId: string;
  }>({
    isOpen: false,
    inviteId: "",
  });
  const [isComanageDialogOpen, setIsComanageDialogOpen] = useState(false);
  const [isTransferDialogOpen, setIsTransferDialogOpen] = useState(false);
  const formFocusRef = useRef<HTMLFormElement>(null);

  const formMethods = useForm<FormValues>({
    resolver: yupResolver(FormSchema),
    defaultValues: {
      dateFormat: feed?.formatOptions?.dateFormat || "",
      dateTimezone: feed?.formatOptions?.dateTimezone || "",
      dateLocale: feed?.formatOptions?.dateLocale || "",
      oldArticleDateDiffMsThreshold: feed?.dateCheckOptions?.oldArticleDateDiffMsThreshold || 0,
      shareManageOptions: feed?.shareManageOptions || null,
      userRefreshRateMinutes:
        (
          Number(getEffectiveRefreshRateSeconds(feed || { refreshRateSeconds: 0 }).toFixed(1)) / 60
        )?.toString() || "",
      scheduleMode: feed?.scheduleMode === "scheduled" ? "scheduled" : "interval",
      scheduleTimes: feed?.schedule?.times?.length ? feed.schedule.times : [SCHEDULE_DEFAULT_TIME],
      scheduleTimezone: feed?.schedule?.timezone || browserTimezone(),
      // Absent days on the feed means every day.
      scheduleDays:
        feed?.schedule?.days && !isEveryDay(feed.schedule.days)
          ? feed.schedule.days
          : ALL_SCHEDULE_DAYS,
    },
  });
  const {
    handleSubmit,
    control,
    reset,
    formState: { errors: formErrors },
    watch,
    setValue,
  } = formMethods;

  const [dateFormat, dateTimezone, dateLocale] = watch([
    "dateFormat",
    "dateTimezone",
    "dateLocale",
  ]);

  const scheduleMode = watch("scheduleMode");
  const scheduleTimezone = watch("scheduleTimezone");
  const scheduleDays = watch("scheduleDays");

  const scheduleTimesErrors = formErrors.scheduleTimes as
    | { message?: string }
    | Array<{ message?: string } | undefined>
    | undefined;
  const scheduleTimesListError = !Array.isArray(scheduleTimesErrors)
    ? scheduleTimesErrors?.message
    : undefined;
  const scheduleTimeRowErrors = Array.isArray(scheduleTimesErrors)
    ? scheduleTimesErrors.map((e) => e?.message)
    : undefined;

  const debouncedPreviewInput = useDebounce(
    {
      dateFormat,
      dateTimezone,
      dateLocale,
    },
    400,
  );

  const { data: datePreviewData, error: datePreviewError } = useUserFeedDatePreview({
    feedId,
    data: debouncedPreviewInput,
  });

  const { mutateAsync } = useUpdateUserFeed();
  const {
    mutateAsync: createUserFeedManagementInvite,
    status: creatingInvitesStatus,
    error: createInviteError,
    reset: resetCreateInvite,
  } = useCreateUserFeedManagementInvite();
  const {
    mutateAsync: deleteUserFeedManagementInvite,
    status: deletingInviteStatus,
    error: deleteInviteError,
    reset: resetDeleteInvite,
  } = useDeleteUserFeedManagementInvite({ feedId });
  const { createSuccessAlert, createErrorAlert } = usePageAlertContext();

  const onUpdatedFeed = async (values: FormValues) => {
    try {
      const userRefreshRateMinutesInSeconds = !Number.isNaN(values.userRefreshRateMinutes)
        ? Number(values.userRefreshRateMinutes) * 60
        : undefined;
      const isScheduledMode = values.scheduleMode === "scheduled";
      const updatedFeed = await mutateAsync({
        feedId,
        data: {
          shareManageOptions: values.shareManageOptions || undefined,
          formatOptions: {
            dateFormat: values.dateFormat?.trim() || undefined,
            dateTimezone: values.dateTimezone?.trim() || undefined,
            dateLocale: values.dateLocale?.trim() || undefined,
          },
          dateCheckOptions:
            values.oldArticleDateDiffMsThreshold !== undefined &&
            values.oldArticleDateDiffMsThreshold !== null
              ? {
                  oldArticleDateDiffMsThreshold: values.oldArticleDateDiffMsThreshold,
                }
              : undefined,
          // In scheduled mode the interval value is left untouched on the
          // server so switching back to interval mode is lossless.
          ...(isScheduledMode
            ? {
                scheduleMode: "scheduled" as const,
                schedule: {
                  times: [
                    ...new Set(
                      values.scheduleTimes?.filter((t) => SCHEDULE_TIME_PATTERN.test(t)) || [],
                    ),
                  ].sort(),
                  timezone: values.scheduleTimezone || browserTimezone(),
                  // All seven days is the canonical "every day" form, sent
                  // without the days field.
                  ...(values.scheduleDays?.length === 7
                    ? {}
                    : {
                        days: [...new Set(values.scheduleDays || [])].sort((a, b) => a - b),
                      }),
                },
              }
            : {
                scheduleMode: "interval" as const,
                userRefreshRateSeconds: userRefreshRateMinutesInSeconds,
              }),
        },
      });

      reset({
        dateFormat: updatedFeed.result.formatOptions?.dateFormat || "",
        dateTimezone: updatedFeed.result.formatOptions?.dateTimezone || "",
        dateLocale: updatedFeed.result.formatOptions?.dateLocale || "",
        oldArticleDateDiffMsThreshold:
          updatedFeed.result.dateCheckOptions?.oldArticleDateDiffMsThreshold,
        shareManageOptions: updatedFeed.result.shareManageOptions || null,
        userRefreshRateMinutes: (getEffectiveRefreshRateSeconds(updatedFeed.result) / 60).toFixed(
          1,
        ),
        scheduleMode: updatedFeed.result.scheduleMode === "scheduled" ? "scheduled" : "interval",
        scheduleTimes: updatedFeed.result.schedule?.times?.length
          ? updatedFeed.result.schedule.times
          : [SCHEDULE_DEFAULT_TIME],
        scheduleTimezone: updatedFeed.result.schedule?.timezone || browserTimezone(),
        scheduleDays: isEveryDay(updatedFeed.result.schedule?.days)
          ? ALL_SCHEDULE_DAYS
          : updatedFeed.result.schedule?.days,
      });
      createSuccessAlert({
        title: "Successfully updated feed settings",
      });
    } catch (e) {
      const fastestAllowedRate = Math.min(
        ...(feed?.refreshRateOptions.filter((r) => !r.disabledCode).map((o) => o.rateSeconds) ||
          []),
      );
      const canHaveLowerRate = feed?.refreshRateOptions.filter(
        (r) => r.disabledCode === "INSUFFICIENT_SUPPORTER_TIER",
      );

      if (e instanceof ApiAdapterError && e.errorCode === "USER_REFRESH_RATE_NOT_ALLOWED") {
        createErrorAlert({
          title: "Refresh rate is not allowed.",
          description: (
            <Text>
              Your selected refresh rate must be greater than or equal to
              {(fastestAllowedRate / 60).toFixed(1)} minutes and less than or equal to 1440.0
              minutes (1 day).
              {canHaveLowerRate && (
                <>
                  {" "}
                  <ChakraLink
                    color="text.link"
                    href="https://monitorss.xyz/pricing"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Get lower rates by being a paid supporter.
                  </ChakraLink>
                </>
              )}
            </Text>
          ),
        });
      } else {
        createErrorAlert({
          title: t("common.errors.failedToSave"),
          description: e instanceof Error ? e.message : undefined,
        });
      }
    }
  };

  const onAddUser = async ({
    id,
    type,
    connections,
  }: {
    id: string;
    type: UserFeedManagerInviteType;
    connections: Array<{ connectionId: string }>;
  }) => {
    await createUserFeedManagementInvite({
      data: {
        feedId,
        discordUserId: id,
        type,
        connections,
      },
    });
    createSuccessAlert({
      title: `Successfully sent feed management invite`,
    });
  };

  const removeInvite = async (id: string) => {
    await deleteUserFeedManagementInvite({ id });

    createSuccessAlert({
      title: `Successfully removed feed management invite`,
    });
  };

  if (feedStatus === "loading") {
    return (
      <Center>
        <Loading size="xl" />
      </Center>
    );
  }

  if (feedError) {
    return (
      <InlineErrorAlert
        title={t("common.errors.somethingWentWrong")}
        description={feedError.message}
      />
    );
  }

  return (
    <PageAlertProvider>
      <FormProvider {...formMethods}>
        <form
          ref={formFocusRef}
          onSubmit={handleSubmit(onUpdatedFeed)}
          id="user-management"
          aria-label="Feed settings"
        >
          <ManageUserFeedManagementInviteSettingsDialog
            feedId={feedId}
            inviteId={manageInviteDialogState.inviteId}
            isOpen={manageInviteDialogState.isOpen}
            onClose={() => setManageInviteDialogState({ isOpen: false, inviteId: "" })}
          />
          <Heading size="md" as="h2" mb={8}>
            Miscellaneous Feed Settings
          </Heading>
          <Stack gap={8} marginBottom={8}>
            {!feed?.isWorkspaceFeed && (
              <Stack gap={4} border="1px solid" borderColor="border" borderRadius="l3" p={4}>
                <Stack gap={2}>
                  <Heading size="sm" as="h3">
                    Feed Management Invites
                  </Heading>
                  <Text>
                    Share this feed with users who you would like to also manage this feed. After
                    they accept it, this shared feed will count towards their feed limit. To revoke
                    access, delete their invite.
                  </Text>
                  {!feed?.connections.length && (
                    <Alert
                      role="none"
                      title="You must have at least one feed connection created to create feed management invites."
                    >
                      <Box>
                        <Button asChild>
                          <ChakraLink
                            href={pages.userFeed(feed?.id || "", {
                              tab: UserFeedTabSearchParam.Connections,
                              scope: workspaceSlug ? { workspaceSlug } : undefined,
                            })}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <HStack alignItems="center">
                              <Text>View and create connections</Text>
                              <FaUpRightFromSquare />
                            </HStack>
                          </ChakraLink>
                        </Button>
                      </Box>
                    </Alert>
                  )}
                  <PageAlertContextOutlet />
                </Stack>
                <Stack>
                  <Separator />
                  {feed && feed.sharedAccessDetails && (
                    <Alert status="warning">
                      Only the feed owner can manage feed management invites.
                    </Alert>
                  )}
                  {feed && !feed.sharedAccessDetails && (
                    <Stack>
                      <Text
                        hidden={!!feed.shareManageOptions?.invites.length}
                        color="fg.muted"
                        pt={2}
                      >
                        This feed does not have any users with feed management access.
                      </Text>
                      <TableScrollArea hidden={!feed.shareManageOptions?.invites.length}>
                        <TableRoot variant="line">
                          <TableHeader>
                            <TableRow>
                              <TableColumnHeader>Name</TableColumnHeader>
                              <TableColumnHeader>Type</TableColumnHeader>
                              <TableColumnHeader>Status</TableColumnHeader>
                              <TableColumnHeader>Connections</TableColumnHeader>
                              <TableColumnHeader>Added On</TableColumnHeader>
                              <TableColumnHeader />
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {feed.shareManageOptions?.invites.map((u) => {
                              const connectionIds = new Set(
                                u.connections?.map((c) => c.connectionId) || [],
                              );
                              const connectionNames = Object.values(feed.connections)
                                .filter((c) => connectionIds.has(c.id))
                                .map((c) => c.name);

                              return (
                                <TableRow key={u.id}>
                                  <TableCell>
                                    <DiscordUsername userId={u.discordUserId} />
                                  </TableCell>
                                  <TableCell>
                                    {(!u.type || u.type === UserFeedManagerInviteType.CoManage) && (
                                      <Text>Co-manage</Text>
                                    )}
                                    {u.type === UserFeedManagerInviteType.Transfer && (
                                      <Text>Ownership transfer</Text>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    {u.status === UserFeedManagerStatus.Accepted && (
                                      <Tag colorPalette="green">Accepted</Tag>
                                    )}
                                    {u.status === UserFeedManagerStatus.Pending && (
                                      <Tag colorPalette="yellow">Pending</Tag>
                                    )}
                                    {u.status === UserFeedManagerStatus.Declined && (
                                      <HStack>
                                        <Tag colorPalette="red">Declined</Tag>
                                        <ResendUserFeedManagementInviteButton
                                          feedId={feedId}
                                          inviteId={u.id}
                                        />
                                      </HStack>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <Stack>
                                      {!connectionNames.length && <Text>All</Text>}
                                      {connectionNames.map((n) => (
                                        <Text display="block" key={n}>
                                          {n}
                                        </Text>
                                      ))}
                                    </Stack>
                                  </TableCell>
                                  <TableCell>{u.createdAt}</TableCell>
                                  <TableCell textAlign="right">
                                    <HStack>
                                      <IconButton
                                        aria-label="Manage invite settings"
                                        size="sm"
                                        variant="ghost"
                                        onClick={() =>
                                          setManageInviteDialogState({
                                            isOpen: true,
                                            inviteId: u.id,
                                          })
                                        }
                                      >
                                        <FaGear />
                                      </IconButton>
                                      <ConfirmModal
                                        trigger={
                                          <IconButton
                                            size="sm"
                                            aria-label="Delete user"
                                            variant="ghost"
                                            disabled={deletingInviteStatus === "loading"}
                                          >
                                            <FaTrash />
                                          </IconButton>
                                        }
                                        okText="Delete"
                                        title="Delete User"
                                        description="Are you sure you want to remove this user? They will lose access to this feed."
                                        colorScheme="red"
                                        onConfirm={() => removeInvite(u.id)}
                                        onClosed={resetDeleteInvite}
                                        error={deleteInviteError?.message}
                                      />
                                    </HStack>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </TableRoot>
                      </TableScrollArea>
                    </Stack>
                  )}
                  {!!feed?.connections.length && (
                    <MenuRoot>
                      <MenuTrigger asChild>
                        <Button
                          aria-disabled={
                            !feed?.connections.length ||
                            creatingInvitesStatus === "loading" ||
                            !!feed?.sharedAccessDetails?.inviteId
                          }
                          width="min-content"
                        >
                          Invite user to...
                          <FaChevronDown />
                        </Button>
                      </MenuTrigger>
                      <MenuContent>
                        <MenuItem value="co-manage" onSelect={() => setIsComanageDialogOpen(true)}>
                          Co-manage feed
                        </MenuItem>
                        <MenuItem
                          value="transfer"
                          color="text.error"
                          onSelect={() => setIsTransferDialogOpen(true)}
                        >
                          Transfer ownership
                        </MenuItem>
                      </MenuContent>
                    </MenuRoot>
                  )}
                  <AddFeedComanagerDialog
                    open={isComanageDialogOpen}
                    onOpenChange={setIsComanageDialogOpen}
                  />
                  <SelectUserDialog
                    open={isTransferDialogOpen}
                    onOpenChange={setIsTransferDialogOpen}
                    description={
                      <Text>
                        This user will have full ownership of this feed, and you will lose access to
                        it after they accept the invite. They must accept the invite by logging in.
                      </Text>
                    }
                    title="Invite User to Transfer Ownership"
                    okButtonText="Invite User to Transfer Ownership"
                    onAdded={({ id }) =>
                      onAddUser({
                        id,
                        type: UserFeedManagerInviteType.Transfer,
                        connections: [],
                      })
                    }
                    onClosed={resetCreateInvite}
                    error={createInviteError?.message}
                  />
                </Stack>
              </Stack>
            )}
            <Stack gap={4} border="1px solid" borderColor="border" borderRadius="l3" p={4}>
              <Stack gap={2}>
                <Heading size="sm" as="h3">
                  Refresh Rate
                </Heading>
                {scheduleMode === "scheduled" ? (
                  <Text>
                    The feed is fetched and delivered once at each scheduled time below. Your
                    refresh rate is kept and applies again if you switch back.
                  </Text>
                ) : (
                  <Text>
                    Change the rate at which the bot sends requests for this feed. If you are facing
                    rate limits for this feed, this may be helpful, but is not guaranteed to resolve
                    rate-limit-related issues. If other users are using this feed at a rate faster
                    than what you set here, the bot will ignore this setting.
                  </Text>
                )}
                <Separator mt={2} />
                <Controller
                  name="scheduleMode"
                  control={control}
                  render={({ field }) => (
                    <SegmentedControl
                      value={field.value}
                      onValueChange={(details) => field.onChange(details.value)}
                      items={[
                        { value: "interval", label: "Refresh rate" },
                        { value: "scheduled", label: "Scheduled times" },
                      ]}
                      aria-label="Scheduling mode"
                    />
                  )}
                />
              </Stack>
              {scheduleMode === "scheduled" ? (
                <Controller
                  name="scheduleTimes"
                  control={control}
                  render={({ field }) => (
                    <FeedScheduleSettings
                      times={field.value ?? []}
                      onTimesChange={field.onChange}
                      timeErrors={scheduleTimeRowErrors}
                      timesListError={scheduleTimesListError}
                      days={scheduleDays ?? ALL_SCHEDULE_DAYS}
                      onDaysChange={(days) =>
                        setValue("scheduleDays", days, { shouldDirty: true })
                      }
                      daysError={formErrors.scheduleDays?.message}
                      timezone={scheduleTimezone || browserTimezone()}
                      onTimezoneChange={(tz) =>
                        setValue("scheduleTimezone", tz, { shouldDirty: true })
                      }
                      timezoneError={formErrors.scheduleTimezone?.message}
                    />
                  )}
                />
              ) : (
                <>
                  {!feed?.refreshRateOptions.length && (
                    <Text color="fg.muted">This feed does not have any refresh rate options.</Text>
                  )}
                  {!!feed?.refreshRateOptions.length && (
                    <Controller
                      name="userRefreshRateMinutes"
                      control={control}
                      render={({ field }) => {
                        return (
                          <Field
                            invalid={!!formErrors.oldArticleDateDiffMsThreshold}
                            errorText={formErrors.userRefreshRateMinutes?.message}
                          >
                            <HStack alignItems="center" gap={4}>
                              <NumberInputRoot
                                allowMouseWheel
                                step={0.1}
                                value={field.value}
                                onValueChange={(details) => {
                                  return field.onChange(details.value);
                                }}
                                onBlur={() => field.onBlur()}
                                disabled={!user || field.disabled}
                                ref={field.ref}
                                name={field.name}
                              >
                                <NumberInputField />
                              </NumberInputRoot>
                              <Text as="label">minutes</Text>
                            </HStack>
                          </Field>
                        );
                      }}
                    />
                  )}
                </>
              )}
            </Stack>
            <Stack gap={4} border="1px solid" borderColor="border" borderRadius="l3" p={4}>
              <Stack gap={2}>
                <Heading size="sm" as="h3" pb={2}>
                  Article Date Checks
                </Heading>
                <Separator />
              </Stack>
              <Controller
                name="oldArticleDateDiffMsThreshold"
                control={control}
                render={({ field }) => {
                  return (
                    <Field
                      invalid={!!formErrors.oldArticleDateDiffMsThreshold}
                      errorText={formErrors.oldArticleDateDiffMsThreshold?.message}
                      helperText={
                        !formErrors.oldArticleDateDiffMsThreshold ? (
                          <>
                            Set to <Code>0</Code> to disable. Articles that have no published date
                            will also be ignored if this is enabled. It is strongly advised to leave
                            this at the default, unless you face issues otherwise.
                          </>
                        ) : undefined
                      }
                    >
                      <Text as="label" id={`${field.name}-label-1`}>
                        Never deliver articles older than
                      </Text>
                      <HStack alignItems="center" gap={4}>
                        <NumberInputRoot
                          min={0}
                          allowMouseWheel
                          name={field.name}
                          disabled={field.disabled}
                          ref={field.ref}
                          onBlur={field.onBlur}
                          onValueChange={(details) =>
                            Number.isNaN(Number(details.value))
                              ? field.onChange(null)
                              : field.onChange(Number(details.value) * 1000 * 60 * 60 * 24)
                          }
                          value={
                            typeof field.value === "number"
                              ? String(field.value / 1000 / 60 / 60 / 24)
                              : ""
                          }
                          aria-describedby={`${field.name}-label-1 ${field.name}-label-2`}
                        >
                          <NumberInputField />
                        </NumberInputRoot>
                        <Text as="label" id={`${field.name}-label-2`}>
                          days
                        </Text>
                      </HStack>
                    </Field>
                  );
                }}
              />
            </Stack>
            <Stack gap={4} border="1px solid" borderColor="border" borderRadius="l3" p={4}>
              <Stack gap={2}>
                <Heading size="sm" as="h3">
                  {t(
                    "features.feedConnections.components.userFeedSettingsTabSection.dateSettingsTitle",
                  )}
                </Heading>
                <Text>
                  Change how dates are formatted if you use date placeholders in your message. If
                  you&apos;ve already configured date settings in your{" "}
                  <ChakraLink asChild color="text.link">
                    <RouterLink to={pages.userSettings()}>Account Settings</RouterLink>
                  </ChakraLink>
                  , they will be overridden by the settings here.
                </Text>
                <Separator mt={2} />
              </Stack>
              <Stack gap={4}>
                <Field aria-live="polite" aria-busy={!!datePreviewData}>
                  <Text as="label" marginBottom={0}>
                    {t(
                      "features.feedConnections.components.userFeedSettingsTabSection.dateSettingsPreviewTitle",
                    )}
                  </Text>
                  {!datePreviewError && (
                    <Skeleton loading={!datePreviewData}>
                      <Text
                        fontSize="xl"
                        color={datePreviewData?.result.valid ? "fg.muted" : "text.error"}
                      >
                        {datePreviewData?.result.valid && datePreviewData?.result.output}
                        {!datePreviewData?.result.valid &&
                          t(
                            "features.feedConnections.components.userFeedSettingsTabSection.invalidTimezone",
                          )}
                      </Text>
                    </Skeleton>
                  )}
                  {datePreviewError && (
                    <InlineErrorAlert
                      title="Failed to load date preview"
                      description={datePreviewError.message}
                    />
                  )}
                </Field>
                <Controller
                  name="dateTimezone"
                  control={control}
                  render={({ field }) => (
                    <Field
                      invalid={!!formErrors.dateTimezone}
                      label={t(
                        "features.feedConnections.components.userFeedSettingsTabSection.dateTimezoneInputLabel",
                      )}
                      errorText={
                        formErrors.dateTimezone ? (
                          <>
                            {formErrors.dateTimezone.message} (
                            <Trans
                              i18nKey="features.feedConnections.components.userFeedSettingsTabSection.dateTimezoneInputDescription"
                              components={[
                                <ChakraLink
                                  href="https://en.wikipedia.org/wiki/List_of_tz_database_time_zones"
                                  target="_blank"
                                  rel="noreferrer noopener"
                                  color="text.link"
                                />,
                              ]}
                            />
                            )
                          </>
                        ) : undefined
                      }
                      helperText={
                        !formErrors.dateTimezone ? (
                          <Trans
                            i18nKey="features.feedConnections.components.userFeedSettingsTabSection.dateTimezoneInputDescription"
                            components={[
                              <ChakraLink
                                href="https://en.wikipedia.org/wiki/List_of_tz_database_time_zones"
                                target="_blank"
                                rel="noreferrer noopener"
                                color="text.link"
                              />,
                            ]}
                          />
                        ) : undefined
                      }
                    >
                      <Input spellCheck={false} autoComplete="off" {...field} />
                    </Field>
                  )}
                />
                <Controller
                  name="dateFormat"
                  control={control}
                  render={({ field }) => (
                    <Field
                      invalid={!!formErrors.dateFormat}
                      label={t(
                        "features.feedConnections.components.userFeedSettingsTabSection.dateFormatInputLabel",
                      )}
                      errorText={formErrors.dateFormat?.message}
                      helperText={
                        !formErrors.dateFormat ? (
                          <>
                            This will dictate how the placeholders with dates (such as{" "}
                            <Code>{`{{date}}`}</Code> ) will be formatted. For more information on
                            formatting, see{" "}
                            <ChakraLink
                              color="text.link"
                              target="_blank"
                              rel="noopener noreferrer"
                              href="https://day.js.org/docs/en/display/format"
                            >
                              https://day.js.org/docs/en/display/format
                            </ChakraLink>
                          </>
                        ) : undefined
                      }
                    >
                      <Input spellCheck={false} autoComplete="off" {...field} />
                    </Field>
                  )}
                />
                <Controller
                  name="dateLocale"
                  control={control}
                  render={({ field }) => (
                    <Field
                      invalid={!!formErrors.dateLocale}
                      label="Date Format Locale"
                      errorText={formErrors.dateLocale?.message}
                      helperText={
                        !formErrors.dateLocale ? (
                          <>
                            The locale to use for formatting dates. Leave blank to use the default (
                            <Code>English</Code>).
                          </>
                        ) : undefined
                      }
                    >
                      <NativeSelectRoot>
                        <NativeSelectField placeholder="Select option" {...field}>
                          {DATE_LOCALES.map(({ key, name }) => (
                            <option key={key} value={key}>
                              {name}
                            </option>
                          ))}
                        </NativeSelectField>
                      </NativeSelectRoot>
                    </Field>
                  )}
                />
              </Stack>
            </Stack>
          </Stack>
          <SavedUnsavedChangesPopupBar useDirtyFormCheck restoreFocusRef={formFocusRef} />
        </form>
      </FormProvider>
    </PageAlertProvider>
  );
};
