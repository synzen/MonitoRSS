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
  NumberDecrementStepper,
  NumberIncrementStepper,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  Stack,
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
import { yupResolver } from "@hookform/resolvers/yup";
import dayjs from "dayjs";
import { Controller, useForm } from "react-hook-form";
import { Trans, useTranslation } from "react-i18next";
import { array, InferType, number, object, string } from "yup";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import { DeleteIcon } from "@chakra-ui/icons";
import { ConfirmModal, InlineErrorAlert, Loading } from "../../../../components";
import { notifyError } from "../../../../utils/notifyError";
import { notifySuccess } from "../../../../utils/notifySuccess";
import {
  useCreateUserFeedManagementInvite,
  useDeleteUserFeedManagementInvite,
  useUpdateUserFeed,
  useUserFeed,
} from "../../../feed/hooks";
import { DiscordUsername } from "../../../discordUser";
import { SelectUserDialog } from "./SelectUserDialog";
import { UserFeedManagerStatus } from "../../../../constants";
import { ResendUserFeedManagementInviteButton } from "./ResendUserFeedManagementInviteButton";

dayjs.extend(utc);
dayjs.extend(timezone);

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
  oldArticleDateDiffMsThreshold: number().optional(),
  shareManageOptions: object({
    users: array(
      object({
        discordUserId: string().required(),
      }).required()
    ).required(),
  })
    .optional()
    .nullable()
    .default(null),
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
      oldArticleDateDiffMsThreshold: feed?.dateCheckOptions?.oldArticleDateDiffMsThreshold || 0,
      shareManageOptions: feed?.shareManageOptions || null,
    },
  });

  const [dateFormat, dateTimezone] = watch(["dateFormat", "dateTimezone", "shareManageOptions"]);

  const { mutateAsync } = useUpdateUserFeed();
  const { mutateAsync: createUserFeedManagementInvite, status: creatingInvitesStatus } =
    useCreateUserFeedManagementInvite();
  const { mutateAsync: deleteUserFeedManagementInvite, status: deletingInviteStatus } =
    useDeleteUserFeedManagementInvite({ feedId });

  const onUpdatedFeed = async (values: FormValues) => {
    try {
      const updatedFeed = await mutateAsync({
        feedId,
        data: {
          shareManageOptions: values.shareManageOptions || undefined,
          formatOptions: {
            dateFormat: values.dateFormat?.trim() || undefined,
            dateTimezone: values.dateTimezone?.trim() || undefined,
          },
          dateCheckOptions:
            values.oldArticleDateDiffMsThreshold !== undefined
              ? {
                  oldArticleDateDiffMsThreshold: values.oldArticleDateDiffMsThreshold,
                }
              : undefined,
        },
      });

      reset({
        dateFormat: updatedFeed.result.formatOptions?.dateFormat || "",
        dateTimezone: updatedFeed.result.formatOptions?.dateTimezone || "",
        oldArticleDateDiffMsThreshold:
          updatedFeed.result.dateCheckOptions?.oldArticleDateDiffMsThreshold,
        shareManageOptions: updatedFeed.result.shareManageOptions || null,
      });
      notifySuccess(t("common.success.savedChanges"));
    } catch (error) {
      notifyError(t("common.errors.somethingWentWrong"), error as Error);
    }
  };

  const onAddUser = async ({ id }: { id: string }) => {
    try {
      await createUserFeedManagementInvite({
        data: {
          feedId,
          discordUserId: id,
        },
      });
      notifySuccess("Successfully sent invite");
    } catch (err) {
      notifyError(t("common.errors.somethingWentWrong"), err as Error);
    }
  };

  const removeInvite = async (id: string) => {
    try {
      await deleteUserFeedManagementInvite({ id });
      notifySuccess("Successfully removed invite");
    } catch (err) {
      notifyError(t("common.errors.somethingWentWrong"), err as Error);
    }
  };

  let datePreview: React.ReactNode;

  try {
    const previewDayjs = dayjs().tz(dateTimezone || "utc");

    datePreview = (
      <Text fontSize="xl" color="gray.400">
        {previewDayjs.format(dateFormat)}
      </Text>
    );
  } catch (err) {
    datePreview = (
      <Text fontSize="xl" color="red.400">
        {t("features.feedConnections.components.userFeedSettingsTabSection.invalidTimezone")}
      </Text>
    );
  }

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
      <Stack spacing={16} marginBottom={8}>
        <Stack spacing={4}>
          <Stack>
            <Heading size="md" as="h3">
              Feed Management Invites
            </Heading>
            <Text>
              Share this feed with users who you would like to also manage this feed. After inviting
              them, they must accept the invite by logging in. After they accept it, this shared
              feed will count towards their feed limit. To revoke access, delete their invite.
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
            {feed && !feed.sharedAccessDetails && feed?.shareManageOptions?.users.length && (
              <TableContainer>
                <Table variant="simple">
                  <Thead>
                    <Tr>
                      <Th>Name</Th>
                      <Th>Status</Th>
                      <Th>Added On</Th>
                      <Th />
                    </Tr>
                  </Thead>
                  <Tbody>
                    {feed.shareManageOptions.users.map((u) => (
                      <Tr key={u.id}>
                        <Td>
                          <DiscordUsername userId={u.discordUserId} />
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
                        <Td>{u.createdAt}</Td>
                        <Td isNumeric>
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
                          />
                        </Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </TableContainer>
            )}
            <SelectUserDialog
              trigger={
                <Button
                  width="min-content"
                  isDisabled={
                    creatingInvitesStatus === "loading" || !!feed?.sharedAccessDetails?.inviteId
                  }
                >
                  Add User
                </Button>
              }
              onAdded={onAddUser}
            />
          </Stack>
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
                    <NumberInput min={0} allowMouseWheel {...field}>
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
                    be ignored if this is enabled.
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
          <Heading size="md" as="h3">
            {t("features.feedConnections.components.userFeedSettingsTabSection.dateSettingsTitle")}
          </Heading>
          <Stack spacing={4}>
            <FormControl>
              <FormLabel marginBottom={0}>
                {t(
                  "features.feedConnections.components.userFeedSettingsTabSection.dateSettingsPreviewTitle"
                )}
              </FormLabel>
              {datePreview}
            </FormControl>
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
                      {t(
                        "features.feedConnections.components.userFeedSettingsTabSection.dateFormatInputDescription"
                      )}
                    </FormHelperText>
                  )}
                  {formErrors.dateFormat && (
                    <FormErrorMessage>{formErrors.dateFormat.message}</FormErrorMessage>
                  )}
                </FormControl>
              )}
            />
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
                            color="blue.400"
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
          </Stack>
        </Stack>
      </Stack>
      <HStack justifyContent="flex-end">
        <Button isDisabled={!isDirty || isSubmitting} onClick={() => reset()} variant="ghost">
          {t("common.buttons.reset")}
        </Button>
        <Button
          type="submit"
          colorScheme="blue"
          isLoading={isSubmitting}
          isDisabled={isSubmitting || !isDirty}
        >
          {t("common.buttons.save")}
        </Button>
      </HStack>
    </form>
  );
};
