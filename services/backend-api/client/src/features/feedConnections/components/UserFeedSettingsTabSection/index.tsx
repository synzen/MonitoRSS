import {
  Alert,
  AlertDescription,
  Button,
  Center,
  Code,
  FormControl,
  FormErrorMessage,
  FormHelperText,
  FormLabel,
  Heading,
  HStack,
  IconButton,
  Input,
  Link,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  NumberDecrementStepper,
  NumberIncrementStepper,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  Radio,
  RadioGroup,
  Select,
  Skeleton,
  Stack,
  StackDivider,
  Table,
  TableContainer,
  Tag,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
} from "@chakra-ui/react";
import { Link as RouterLink } from "react-router-dom";
import { yupResolver } from "@hookform/resolvers/yup";
import dayjs from "dayjs";
import { Controller, useForm } from "react-hook-form";
import { Trans, useTranslation } from "react-i18next";
import { array, InferType, number, object, string } from "yup";
import { ChevronDownIcon, DeleteIcon, SettingsIcon } from "@chakra-ui/icons";
import { useState } from "react";
import { ConfirmModal, InlineErrorAlert, Loading } from "../../../../components";
import { notifySuccess } from "../../../../utils/notifySuccess";
import {
  useCreateUserFeedManagementInvite,
  useDeleteUserFeedManagementInvite,
  useUpdateUserFeed,
  useUserFeed,
} from "../../../feed/hooks";
import { DiscordUsername, useDiscordUserMe } from "../../../discordUser";
import { pages, UserFeedManagerInviteType, UserFeedManagerStatus } from "../../../../constants";
import { ResendUserFeedManagementInviteButton } from "./ResendUserFeedManagementInviteButton";
import { SelectUserDialog } from "./SelectUserDialog";
import DATE_LOCALES from "../../../../constants/dateLocales";
import { useUserFeedDatePreview } from "../../../feed/hooks/useUserFeedDatePreview";
import { useDebounce } from "../../../../hooks";
import { formatRefreshRateSeconds } from "../../../../utils/formatRefreshRateSeconds";
import { ManageUserFeedManagementInviteSettingsDialog } from "./ManageUserFeedManagementInviteSettingsDialog";
import { AddFeedComanagerDialog } from "./AddFeedComanagerDialog";

interface Props {
  feedId: string;
}

const FormSchema = object({
  dateFormat: string().optional(),
  dateTimezone: string().test("is-timezone", "Must be a valid timezone", (val) => {
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
  dateLocale: string().optional(),
  oldArticleDateDiffMsThreshold: number().optional(),
  shareManageOptions: object({
    invites: array(
      object({
        discordUserId: string().required(),
      }).required()
    ).required(),
  })
    .optional()
    .nullable()
    .default(null),
  userRefreshRateSeconds: number().optional(),
});

type FormValues = InferType<typeof FormSchema>;

export const UserFeedSettingsTabSection = ({ feedId }: Props) => {
  const { t } = useTranslation();
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

  const {
    handleSubmit,
    control,
    reset,
    formState: { isDirty, isSubmitting, errors: formErrors },
    watch,
  } = useForm<FormValues>({
    resolver: yupResolver(FormSchema),
    defaultValues: {
      dateFormat: feed?.formatOptions?.dateFormat || "",
      dateTimezone: feed?.formatOptions?.dateTimezone || "",
      dateLocale: feed?.formatOptions?.dateLocale || "",
      oldArticleDateDiffMsThreshold: feed?.dateCheckOptions?.oldArticleDateDiffMsThreshold || 0,
      shareManageOptions: feed?.shareManageOptions || null,
      userRefreshRateSeconds: feed?.userRefreshRateSeconds || feed?.refreshRateSeconds,
    },
  });

  const [dateFormat, dateTimezone, dateLocale] = watch([
    "dateFormat",
    "dateTimezone",
    "dateLocale",
  ]);

  const debouncedPreviewInput = useDebounce(
    {
      dateFormat,
      dateTimezone,
      dateLocale,
    },
    400
  );

  const { data: datePreviewData, error: datePreviewError } = useUserFeedDatePreview({
    feedId,
    data: debouncedPreviewInput,
  });

  const { mutateAsync, error } = useUpdateUserFeed();
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

  const onUpdatedFeed = async (values: FormValues) => {
    try {
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
            values.oldArticleDateDiffMsThreshold !== undefined
              ? {
                  oldArticleDateDiffMsThreshold: values.oldArticleDateDiffMsThreshold,
                }
              : undefined,
          userRefreshRateSeconds: values.userRefreshRateSeconds,
        },
      });

      reset({
        dateFormat: updatedFeed.result.formatOptions?.dateFormat || "",
        dateTimezone: updatedFeed.result.formatOptions?.dateTimezone || "",
        dateLocale: updatedFeed.result.formatOptions?.dateLocale || "",
        oldArticleDateDiffMsThreshold:
          updatedFeed.result.dateCheckOptions?.oldArticleDateDiffMsThreshold,
        shareManageOptions: updatedFeed.result.shareManageOptions || null,
        userRefreshRateSeconds:
          updatedFeed.result.userRefreshRateSeconds || updatedFeed.result.refreshRateSeconds,
      });
      notifySuccess(t("common.success.savedChanges"));
    } catch (e) {}
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
    notifySuccess("Successfully sent invite");
  };

  const removeInvite = async (id: string) => {
    await deleteUserFeedManagementInvite({ id });
    notifySuccess("Successfully removed invite");
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
    <form onSubmit={handleSubmit(onUpdatedFeed)} id="user-management">
      <ManageUserFeedManagementInviteSettingsDialog
        feedId={feedId}
        inviteId={manageInviteDialogState.inviteId}
        isOpen={manageInviteDialogState.isOpen}
        onClose={() => setManageInviteDialogState({ isOpen: false, inviteId: "" })}
      />
      <Stack spacing={12} marginBottom={8} divider={<StackDivider />}>
        <Stack spacing={4}>
          <Stack>
            <Heading size="md" as="h3">
              Feed Management Invites
            </Heading>
            <Text>
              Share this feed with users who you would like to also manage this feed. After they
              accept it, this shared feed will count towards their feed limit. To revoke access,
              delete their invite.
            </Text>
          </Stack>
          <Stack>
            {feed && feed.sharedAccessDetails && (
              <Alert status="warning">
                <AlertDescription>
                  Only the feed owner can manage feed management invites.
                </AlertDescription>
              </Alert>
            )}
            {feed && !feed.sharedAccessDetails && feed?.shareManageOptions?.invites.length && (
              <TableContainer>
                <Table variant="simple">
                  <Thead>
                    <Tr>
                      <Th>Name</Th>
                      <Th>Type</Th>
                      <Th>Status</Th>
                      <Th>Connections</Th>
                      <Th>Added On</Th>
                      <Th />
                    </Tr>
                  </Thead>
                  <Tbody>
                    {feed.shareManageOptions.invites.map((u) => {
                      const connectionIds = new Set(
                        u.connections?.map((c) => c.connectionId) || []
                      );
                      const connectionNames = Object.values(feed.connections)
                        .filter((c) => connectionIds.has(c.id))
                        .map((c) => c.name);

                      return (
                        <Tr key={u.id}>
                          <Td>
                            <DiscordUsername userId={u.discordUserId} />
                          </Td>
                          <Td>
                            {(!u.type || u.type === UserFeedManagerInviteType.CoManage) && (
                              <Text>Co-manage</Text>
                            )}
                            {u.type === UserFeedManagerInviteType.Transfer && (
                              <Text>Ownership transfer</Text>
                            )}
                          </Td>
                          <Td>
                            {u.status === UserFeedManagerStatus.Accepted && (
                              <Tag colorScheme="green">Accepted</Tag>
                            )}
                            {u.status === UserFeedManagerStatus.Pending && (
                              <Tag colorScheme="yellow">Pending</Tag>
                            )}
                            {u.status === UserFeedManagerStatus.Declined && (
                              <HStack>
                                <Tag colorScheme="red">Declined</Tag>
                                <ResendUserFeedManagementInviteButton
                                  feedId={feedId}
                                  inviteId={u.id}
                                />
                              </HStack>
                            )}
                          </Td>
                          <Td>
                            <Stack>
                              {!connectionNames.length && <Text>All</Text>}
                              {connectionNames.map((n) => (
                                <Text display="block" key={n}>
                                  {n}
                                </Text>
                              ))}
                            </Stack>
                          </Td>
                          <Td>{u.createdAt}</Td>
                          <Td isNumeric>
                            <HStack>
                              <IconButton
                                aria-label="Manage invite settings"
                                icon={<SettingsIcon />}
                                size="sm"
                                variant="ghost"
                                onClick={() =>
                                  setManageInviteDialogState({ isOpen: true, inviteId: u.id })
                                }
                              />
                              <ConfirmModal
                                trigger={
                                  <IconButton
                                    size="sm"
                                    aria-label="Delete user"
                                    icon={<DeleteIcon />}
                                    variant="ghost"
                                    isDisabled={deletingInviteStatus === "loading"}
                                  />
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
                          </Td>
                        </Tr>
                      );
                    })}
                  </Tbody>
                </Table>
              </TableContainer>
            )}
            <Menu>
              <MenuButton
                isDisabled={
                  creatingInvitesStatus === "loading" || !!feed?.sharedAccessDetails?.inviteId
                }
                as={Button}
                rightIcon={<ChevronDownIcon />}
                width="min-content"
              >
                Invite user to...
              </MenuButton>
              <MenuList>
                <AddFeedComanagerDialog
                  feedId={feedId}
                  trigger={<MenuItem>Co-manage feed</MenuItem>}
                  description={
                    <Text>
                      This user will have access to manage the settings and the existing connections
                      of this feed. You will retain ownership of this feed after they accept the
                      invite. They must accept the invite by logging in.
                    </Text>
                  }
                  title="Invite User to Co-manage Feed"
                  okButtonText="Invite"
                  error={createInviteError?.message}
                  onAdded={({ id, connections }) =>
                    onAddUser({ id, type: UserFeedManagerInviteType.CoManage, connections })
                  }
                  onClosed={resetCreateInvite}
                />
                <SelectUserDialog
                  trigger={<MenuItem color="red.300">Transfer ownership</MenuItem>}
                  description={
                    <Text>
                      This user will have full ownership of this feed, and you will lose access to
                      it after they accept the invite. They must accept the invite by logging in.
                    </Text>
                  }
                  title="Invite User to Transfer Ownership"
                  okButtonText="Invite"
                  onAdded={({ id }) =>
                    onAddUser({ id, type: UserFeedManagerInviteType.Transfer, connections: [] })
                  }
                  onClosed={resetCreateInvite}
                  error={createInviteError?.message}
                />
              </MenuList>
            </Menu>
          </Stack>
        </Stack>
        <Stack spacing={4}>
          <Stack>
            <Heading size="md" as="h3">
              Refresh Rate
            </Heading>
            <Text>
              Change the rate at which the bot sends requests for this feed. If you are facing rate
              limits for this feed, this may be helpful, but is not guaranteed to resolve
              rate-limit-related issues. If other users are using this feed at a rate faster than
              what you set here, the bot will ignore this setting.
            </Text>
          </Stack>
          <Controller
            name="userRefreshRateSeconds"
            control={control}
            render={({ field }) => {
              return (
                <FormControl isInvalid={!!formErrors.oldArticleDateDiffMsThreshold}>
                  <RadioGroup
                    {...field}
                    value={field.value?.toString()}
                    onChange={(v) => field.onChange(Number(v))}
                    isDisabled={!user}
                  >
                    <Stack>
                      {feed?.refreshRateOptions.map((r) => {
                        const { disabledCode } = r;

                        let reason: string = "";

                        if (disabledCode === "INSUFFICIENT_SUPPORTER_TIER") {
                          reason = "(only available if feed owner has a higher supporter tier)";
                        }

                        const displayDuration = formatRefreshRateSeconds(r.rateSeconds);

                        return (
                          <Radio
                            value={r.rateSeconds.toString()}
                            isDisabled={!!r.disabledCode}
                            key={r.rateSeconds}
                          >
                            {displayDuration}
                            {reason ? ` ${reason}` : ""}
                          </Radio>
                        );
                      })}
                    </Stack>
                  </RadioGroup>
                  {formErrors.userRefreshRateSeconds && (
                    <FormErrorMessage>{formErrors.userRefreshRateSeconds.message}</FormErrorMessage>
                  )}
                </FormControl>
              );
            }}
          />
        </Stack>
        <Stack spacing={4}>
          <Stack>
            <Heading size="md" as="h3">
              Article Date Checks
            </Heading>
          </Stack>
          <Controller
            name="oldArticleDateDiffMsThreshold"
            control={control}
            render={({ field }) => {
              return (
                <FormControl isInvalid={!!formErrors.oldArticleDateDiffMsThreshold}>
                  <FormLabel>Never deliver articles older than</FormLabel>
                  <HStack alignItems="center" spacing={4}>
                    <NumberInput
                      min={0}
                      allowMouseWheel
                      {...field}
                      onChange={(str, num) => field.onChange(num * 1000 * 60 * 60 * 24)}
                      value={
                        typeof field.value === "number" ? field.value / 1000 / 60 / 60 / 24 : 0
                      }
                    >
                      <NumberInputField />
                      <NumberInputStepper>
                        <NumberIncrementStepper />
                        <NumberDecrementStepper />
                      </NumberInputStepper>
                    </NumberInput>
                    <FormLabel>days</FormLabel>
                  </HStack>
                  <FormHelperText>
                    Set to <Code>0</Code> to disable. Articles that have no published date will also
                    be ignored if this is enabled. It is strongly advised to leave this at the
                    default, unless you face issues otherwise.
                  </FormHelperText>
                  {formErrors.oldArticleDateDiffMsThreshold && (
                    <FormErrorMessage>
                      {formErrors.oldArticleDateDiffMsThreshold.message}
                    </FormErrorMessage>
                  )}
                </FormControl>
              );
            }}
          />
        </Stack>
        <Stack spacing={4}>
          <Stack>
            <Heading size="md" as="h3">
              {t(
                "features.feedConnections.components.userFeedSettingsTabSection.dateSettingsTitle"
              )}
            </Heading>
            <Text>
              If you&apos;ve configured date settings in your{" "}
              <Link as={RouterLink} to={pages.userSettings()} color="blue.300">
                Account Settings
              </Link>
              , they will be overridden by the settings here.
            </Text>
          </Stack>
          <Stack spacing={4}>
            <FormControl>
              <FormLabel marginBottom={0}>
                {t(
                  "features.feedConnections.components.userFeedSettingsTabSection.dateSettingsPreviewTitle"
                )}
              </FormLabel>
              {!datePreviewError && (
                <Skeleton isLoaded={!!datePreviewData}>
                  <Text
                    fontSize="xl"
                    color={datePreviewData?.result.valid ? "gray.400" : "red.400"}
                  >
                    {datePreviewData?.result.valid && datePreviewData?.result.output}
                    {!datePreviewData?.result.valid &&
                      t(
                        "features.feedConnections.components.userFeedSettingsTabSection.invalidTimezone"
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
            </FormControl>
            <Controller
              name="dateTimezone"
              control={control}
              render={({ field }) => (
                <FormControl isInvalid={!!formErrors.dateTimezone}>
                  <FormLabel>
                    {t(
                      "features.feedConnections.components.userFeedSettingsTabSection.dateTimezoneInputLabel"
                    )}
                  </FormLabel>
                  <Input spellCheck={false} {...field} />
                  {!formErrors.dateTimezone && (
                    <FormHelperText>
                      <Trans
                        i18nKey="features.feedConnections.components.userFeedSettingsTabSection.dateTimezoneInputDescription"
                        components={[
                          <Link
                            href="https://en.wikipedia.org/wiki/List_of_tz_database_time_zones"
                            target="_blank"
                            rel="noreferrer noopener"
                            color="blue.300"
                          />,
                        ]}
                      />
                    </FormHelperText>
                  )}
                  {formErrors.dateTimezone && (
                    <FormErrorMessage>
                      {formErrors.dateTimezone.message} (
                      <Trans
                        i18nKey="features.feedConnections.components.userFeedSettingsTabSection.dateTimezoneInputDescription"
                        components={[
                          <Link
                            href="https://en.wikipedia.org/wiki/List_of_tz_database_time_zones"
                            target="_blank"
                            rel="noreferrer noopener"
                            color="blue.400"
                          />,
                        ]}
                      />
                      )
                    </FormErrorMessage>
                  )}
                </FormControl>
              )}
            />
            <Controller
              name="dateFormat"
              control={control}
              render={({ field }) => (
                <FormControl isInvalid={!!formErrors.dateFormat}>
                  <FormLabel>
                    {t(
                      "features.feedConnections.components.userFeedSettingsTabSection.dateFormatInputLabel"
                    )}
                  </FormLabel>
                  <Input spellCheck={false} autoComplete="" {...field} />
                  {!formErrors.dateFormat && (
                    <FormHelperText>
                      This will dictate how the placeholders with dates (such as{" "}
                      <Code>{`{{date}}`}</Code> ) will be formatted. For more information on
                      formatting, see{" "}
                      <Link
                        color="blue.300"
                        target="_blank"
                        rel="noopener noreferrer"
                        href="https://day.js.org/docs/en/display/format"
                      >
                        https://day.js.org/docs/en/display/format
                      </Link>
                    </FormHelperText>
                  )}
                  {formErrors.dateFormat && (
                    <FormErrorMessage>{formErrors.dateFormat.message}</FormErrorMessage>
                  )}
                </FormControl>
              )}
            />
            <Controller
              name="dateLocale"
              control={control}
              render={({ field }) => (
                <FormControl isInvalid={!!formErrors.dateLocale}>
                  <FormLabel>Date Format Locale</FormLabel>
                  <Select placeholder="Select option" {...field}>
                    {DATE_LOCALES.map(({ key, name }) => (
                      <option key={key} value={key}>
                        {name}
                      </option>
                    ))}
                  </Select>
                  {!formErrors.dateLocale && (
                    <FormHelperText>
                      The locale to use for formatting dates. Leave blank to use the default (
                      <Code>English</Code>).
                    </FormHelperText>
                  )}
                  {formErrors.dateLocale?.message && (
                    <FormErrorMessage>{formErrors.dateLocale.message}</FormErrorMessage>
                  )}
                </FormControl>
              )}
            />
          </Stack>
        </Stack>
        {error && (
          <InlineErrorAlert
            title={t("common.errors.failedToSave")}
            description={error.message}
            scrollIntoViewOnMount
          />
        )}
      </Stack>
      <HStack justifyContent="flex-end" mb={16}>
        <Button isDisabled={!isDirty || isSubmitting} onClick={() => reset()} variant="ghost">
          <span>{t("common.buttons.reset")}</span>
        </Button>
        <Button
          type="submit"
          colorScheme="blue"
          isLoading={isSubmitting}
          isDisabled={isSubmitting || !isDirty}
        >
          <span>{t("common.buttons.save")}</span>
        </Button>
      </HStack>
    </form>
  );
};
