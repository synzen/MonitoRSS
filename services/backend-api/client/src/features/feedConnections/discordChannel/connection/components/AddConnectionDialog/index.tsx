/* eslint-disable no-nested-ternary */
import {
  Alert,
  Box,
  Button,
  Field as ChakraField,
  HStack,
  Input,
  Stack,
  Text,
  chakra,
} from "@chakra-ui/react";
import { yupResolver } from "@hookform/resolvers/yup";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { InferType, object, string } from "yup";
import type { RefObject } from "react";
import { useEffect, useRef, useCallback, useState } from "react";
import {
  useCreateDiscordChannelConnection,
  useUpdateDiscordChannelConnection,
  useConnectionTemplateSelection,
  useTestSendFlow,
  getTemplateUpdateData,
  useConnectionDialogCallbacks,
} from "../../hooks";
import { FeedDiscordChannelConnection } from "@/types";
import {
  DiscordActiveThreadDropdown,
  DiscordChannelDropdown,
  DiscordServerSearchSelectv2,
  GetDiscordChannelType,
} from "@/features/discordServers";
import { usePageAlertContext } from "@/contexts/PageAlertContext";
import {
  TEMPLATES,
  DEFAULT_TEMPLATE,
  getTemplateById,
} from "../../../templates/constants/templates";
import { TemplateGalleryModal } from "../../../templates/components/TemplateGalleryModal";
import convertMessageBuilderStateToConnectionUpdate from "../../../messageBuilder/utils/convertMessageBuilderStateToConnectionUpdate";
import { ConnectionDialogErrorDisplay } from "./ConnectionDialogErrorDisplay";
import { useIsFeatureAllowed, BlockableFeature } from "@/features/subscriptionProducts";
import {
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
  DialogCloseTrigger,
} from "@/components/ui/dialog";
import { PrimaryActionButton } from "@/components/PrimaryActionButton";
import { Radio, RadioGroup } from "@/components/ui/radio";

enum DiscordCreateChannelThreadMethod {
  Existing = "EXISTING",
  New = "NEW",
  None = "NONE",
}

const formSchema = object({
  name: string().required("Name is required").max(250, "Name must be less than 250 characters"),
  createThreadMethod: string()
    .oneOf([
      DiscordCreateChannelThreadMethod.Existing,
      DiscordCreateChannelThreadMethod.New,
      DiscordCreateChannelThreadMethod.None,
    ])
    .required("Specify whether threads should be used"),
  serverId: string().required("Discord server is required"),
  threadId: string().when("createThreadMethod", ([createThreadMethod], schema) => {
    if (createThreadMethod === DiscordCreateChannelThreadMethod.Existing) {
      return schema.required("Discord channel thread is required");
    }

    return schema.optional();
  }),
  channelId: string().required("Discord channel is required"),
  brandingDisplayName: string().optional(),
  brandingAvatarUrl: string().optional(),
});

interface Props {
  onClose: () => void;
  isOpen: boolean;
  connection?: FeedDiscordChannelConnection;
  feedId?: string;
  finalFocusRef?: RefObject<HTMLElement>;
}

type FormData = InferType<typeof formSchema>;

function getIsForumConnection(connection?: FeedDiscordChannelConnection): boolean {
  const channelType = connection?.details.channel?.type;
  const webhookType = connection?.details.webhook?.type;

  return (
    channelType === "forum" ||
    channelType === "forum-thread" ||
    webhookType === "forum" ||
    webhookType === "forum-thread"
  );
}

export const DiscordTextChannelConnectionDialogContent: React.FC<Props> = ({
  onClose,
  isOpen,
  connection,
  feedId: feedIdProp,
  finalFocusRef,
}) => {
  const isEditing = !!connection;
  const [isForumChannel, setIsForumChannel] = useState(() => getIsForumConnection(connection));

  // Template selection state from shared hook
  const {
    isTemplateStep,
    selectedTemplateId,
    setSelectedTemplateId,
    selectedArticleId,
    setSelectedArticleId,
    feedId,
    userFeed,
    articles,
    feedFields,
    detectedFields,
    isLoadingArticles,
    handleNextStep: templateHandleNextStep,
    handleBackStep,
  } = useConnectionTemplateSelection({ isOpen, isEditing, feedId: feedIdProp });

  const webhookDetails = connection?.details.webhook;
  const channelDetails = connection?.details.channel;
  const hasWebhookOnly = !!webhookDetails && !channelDetails;

  const getDefaultFormValues = (): Partial<FormData> => {
    const brandingValues = {
      brandingDisplayName: webhookDetails?.name || undefined,
      brandingAvatarUrl: webhookDetails?.iconUrl || undefined,
    };

    if (hasWebhookOnly) {
      const wType = webhookDetails.type;

      return {
        name: connection?.name,
        serverId: webhookDetails.guildId,
        channelId: webhookDetails.channelId || undefined,
        threadId: wType === "thread" ? webhookDetails.threadId : undefined,
        createThreadMethod:
          wType === "forum" || wType === "forum-thread"
            ? DiscordCreateChannelThreadMethod.None
            : wType === "thread"
              ? DiscordCreateChannelThreadMethod.Existing
              : DiscordCreateChannelThreadMethod.None,
        ...brandingValues,
      };
    }

    if (isForumChannel) {
      return {
        name: connection?.name,
        serverId: channelDetails?.guildId,
        channelId: channelDetails?.parentChannelId || channelDetails?.id,
        threadId: channelDetails?.parentChannelId ? channelDetails?.id : undefined,
        createThreadMethod: DiscordCreateChannelThreadMethod.None,
        ...brandingValues,
      };
    }

    return {
      name: connection?.name,
      channelId: channelDetails?.parentChannelId || channelDetails?.id,
      serverId: channelDetails?.guildId,
      threadId: channelDetails?.type === "thread" ? channelDetails?.id : undefined,
      createThreadMethod:
        channelDetails?.type === "new-thread"
          ? DiscordCreateChannelThreadMethod.New
          : channelDetails?.type === "thread"
            ? DiscordCreateChannelThreadMethod.Existing
            : DiscordCreateChannelThreadMethod.None,
      ...brandingValues,
    };
  };

  const defaultFormValues = getDefaultFormValues();

  const { t } = useTranslation();
  const {
    handleSubmit,
    control,
    reset,
    watch,
    setValue,
    trigger,
    formState: { errors, isSubmitting, isValid, isSubmitted },
  } = useForm<FormData>({
    resolver: yupResolver(formSchema),
    mode: "onSubmit",
    defaultValues: defaultFormValues,
  });
  const [serverId, channelId, watchedThreadId, watchedCreateThreadMethod] = watch([
    "serverId",
    "channelId",
    "threadId",
    "createThreadMethod",
  ]);
  const { mutateAsync, error, reset: resetCreateError } = useCreateDiscordChannelConnection();
  const {
    mutateAsync: updateMutateAsync,
    error: updateError,
    reset: resetUpdateError,
  } = useUpdateDiscordChannelConnection();
  const initialFocusRef = useRef<any>(null);
  const { createSuccessAlert } = usePageAlertContext();
  const { allowed: brandingAllowed } = useIsFeatureAllowed({
    feature: BlockableFeature.DiscordWebhooks,
  });

  // Shared callbacks from hook
  const { onSaveSuccess } = useConnectionDialogCallbacks();

  const handleClose = useCallback(() => {
    reset();
    setIsForumChannel(getIsForumConnection(connection));
    resetCreateError();
    resetUpdateError();
    onClose();
  }, [onClose, reset, connection, resetCreateError, resetUpdateError]);

  // Create connection callback for test send flow
  const createConnection = useCallback(
    async (branding?: { name: string; iconUrl?: string }): Promise<void> => {
      if (!feedId) {
        throw new Error("Feed ID missing");
      }

      const formValues = watch();
      const { name, createThreadMethod, channelId: inputChannelId, threadId } = formValues;

      if (!name) {
        throw new Error("Connection name is missing");
      }

      // Get template data to include in create call
      const templateData = getTemplateUpdateData(selectedTemplateId, detectedFields);

      await mutateAsync({
        feedId,
        details: {
          name,
          ...(branding?.name
            ? {
                applicationWebhook: {
                  channelId: inputChannelId,
                  name: branding.name,
                  iconUrl: branding.iconUrl,
                  threadId: threadId || undefined,
                },
              }
            : { channelId: threadId || inputChannelId }),
          threadCreationMethod:
            !isForumChannel && createThreadMethod === DiscordCreateChannelThreadMethod.New
              ? "new-thread"
              : undefined,
          content: templateData.content,
          embeds: templateData.embeds,
          componentsV2: templateData.componentsV2,
          placeholderLimits: templateData.placeholderLimits,
          formatter: templateData.formatter,
        },
      });
    },
    [feedId, watch, mutateAsync, selectedTemplateId, detectedFields, isForumChannel],
  );

  // Get connection name from form
  const getConnectionName = useCallback(() => watch("name"), [watch]);

  // Determine the effective channel/thread ID for test send
  const testSendChannelId = isForumChannel
    ? watchedThreadId || channelId
    : watchedCreateThreadMethod === DiscordCreateChannelThreadMethod.Existing && watchedThreadId
      ? watchedThreadId
      : channelId;

  // Test send flow hook
  const {
    testSendFeedback,
    isSaving,
    isTestSending,
    handleTestSend,
    handleSave,
    clearTestSendFeedback,
  } = useTestSendFlow({
    feedId,
    channelId: testSendChannelId,
    channelNewThread:
      !isForumChannel && watchedCreateThreadMethod === DiscordCreateChannelThreadMethod.New,
    selectedTemplateId,
    selectedArticleId,
    detectedFields,
    isOpen,
    createConnection,
    onSaveSuccess,
    onClose: handleClose,
    getConnectionName,
  });

  useEffect(() => {
    if (connection) {
      setIsForumChannel(getIsForumConnection(connection));
      reset(defaultFormValues);
    }
  }, [connection?.id]);

  const onSubmit = async ({
    name,
    createThreadMethod,
    channelId: inputChannelId,
    threadId,
    brandingDisplayName,
    brandingAvatarUrl,
  }: FormData) => {
    if (!feedId) {
      throw new Error("Feed ID missing while creating discord channel connection");
    }

    if (connection) {
      try {
        const brandingPayload =
          brandingAllowed && brandingDisplayName?.trim()
            ? {
                applicationWebhook: {
                  name: brandingDisplayName.trim(),
                  iconUrl: brandingAvatarUrl?.trim() || undefined,
                  channelId: inputChannelId,
                  threadId: threadId || (undefined as string | undefined),
                },
              }
            : {};

        if (isForumChannel) {
          if (threadId) {
            await updateMutateAsync({
              feedId,
              connectionId: connection.id,
              details: {
                channelId: threadId,
                ...brandingPayload,
              },
            });
          } else {
            await updateMutateAsync({
              feedId,
              connectionId: connection.id,
              details: {
                name,
                channelId: inputChannelId,
                ...brandingPayload,
              },
            });
          }
        } else {
          const effectiveChannelId =
            createThreadMethod === DiscordCreateChannelThreadMethod.Existing && threadId
              ? threadId
              : inputChannelId;

          await updateMutateAsync({
            feedId,
            connectionId: connection.id,
            details: {
              name,
              channelId: effectiveChannelId,
              threadCreationMethod:
                createThreadMethod === DiscordCreateChannelThreadMethod.New
                  ? "new-thread"
                  : undefined,
              ...brandingPayload,
            },
          });
        }

        createSuccessAlert({
          title: "Successfully updated connection.",
        });
        handleClose();
      } catch (err) {
        // Error handled by mutation error state
      }

      return;
    }

    try {
      // Get the template to apply (selected or default)
      const templateToApply = selectedTemplateId
        ? getTemplateById(selectedTemplateId) || DEFAULT_TEMPLATE
        : DEFAULT_TEMPLATE;

      // Create message component with detected fields and convert to API format
      const messageComponent = templateToApply.createMessageComponent(detectedFields);
      const templateData = convertMessageBuilderStateToConnectionUpdate(messageComponent);

      // Create the connection with template data in a single atomic operation
      await mutateAsync({
        feedId,
        details: {
          name,
          channelId: threadId || inputChannelId,
          threadCreationMethod:
            !isForumChannel && createThreadMethod === DiscordCreateChannelThreadMethod.New
              ? "new-thread"
              : undefined,
          content: templateData.content,
          embeds: templateData.embeds,
          componentsV2: templateData.componentsV2,
          placeholderLimits: templateData.placeholderLimits,
          formatter: templateData.formatter,
        },
      });

      createSuccessAlert({
        title: "You're all set!",
        description: `New articles will be delivered automatically to ${name || "your channel"}.`,
      });
      handleClose();
    } catch (err) {
      // Error handled by mutation error state
    }
  };

  const handleNextStep = async () => {
    const fieldsToValidate: (keyof FormData)[] = isForumChannel
      ? ["serverId", "channelId", "name"]
      : ["serverId", "channelId", "name", "createThreadMethod", "threadId"];

    const isServerChannelValid = await trigger(fieldsToValidate);

    if (isServerChannelValid) {
      resetCreateError();
      resetUpdateError();
      templateHandleNextStep();
    }
  };

  const handleBackToChannel = () => {
    clearTestSendFeedback();
    resetCreateError();
    resetUpdateError();
    handleBackStep();
  };

  const errorCount = Object.keys(errors).length;

  const submissionError = error || updateError;

  const brandingDisabledReason =
    !isForumChannel && watchedCreateThreadMethod === DiscordCreateChannelThreadMethod.New
      ? "Display name and avatar customization aren't available with the new thread option. To customize these, go back and select a different thread setting."
      : undefined;

  // For template selection step, show TemplateGalleryModal instead of regular modal
  if (isTemplateStep) {
    return (
      <TemplateGalleryModal
        mode="editor"
        isOpen={isOpen}
        onClose={handleClose}
        finalFocusRef={finalFocusRef}
        templates={TEMPLATES}
        selectedTemplateId={selectedTemplateId}
        onTemplateSelect={setSelectedTemplateId}
        feedFields={feedFields}
        detectedFields={detectedFields}
        articles={articles.map((a) => ({
          id: a.id,
          title: (a as Record<string, unknown>).title as string | undefined,
        }))}
        selectedArticleId={selectedArticleId}
        onArticleChange={setSelectedArticleId}
        isLoadingArticles={isLoadingArticles}
        feedId={feedId || ""}
        userFeed={userFeed}
        tertiaryActionLabel="Back to channel"
        onTertiaryAction={handleBackToChannel}
        onCancel={handleClose}
        testId="template-selection-modal"
        onTestSend={handleTestSend}
        isTestSendLoading={isTestSending}
        testSendFeedback={testSendFeedback}
        onClearTestSendFeedback={clearTestSendFeedback}
        onSave={handleSave}
        isSaveLoading={isSaving || isSubmitting}
        saveError={error || updateError}
        brandingDisabledReason={brandingDisabledReason}
      />
    );
  }

  return (
    <DialogRoot
      open={isOpen}
      onOpenChange={(e) => {
        if (!e.open) {
          handleClose();
        }
      }}
      closeOnInteractOutside={!isSubmitting}
      initialFocusEl={() => initialFocusRef.current}
      finalFocusEl={() => finalFocusRef?.current ?? null}
    >
      <DialogContent>
        <DialogHeader marginRight={8}>
          <DialogTitle>
            {connection ? "Edit Discord Connection" : "Add Discord Connection"}
          </DialogTitle>
        </DialogHeader>
        <DialogCloseTrigger />
        <DialogBody>
          <Stack gap={4}>
            <Text>Send articles as a message to a Discord channel or forum.</Text>
            <form id="add-text-channel-connection" onSubmit={handleSubmit(onSubmit)}>
              <Stack gap={6}>
                <ChakraField.Root invalid={!!errors.serverId} required>
                  <ChakraField.Label id="server-select-label" htmlFor="server-select">
                    {t(
                      "features.feed.components.addDiscordChannelConnectionDialog.formServerLabel",
                    )}
                    <ChakraField.RequiredIndicator />
                  </ChakraField.Label>
                  <Controller
                    name="serverId"
                    control={control}
                    render={({ field }) => (
                      <DiscordServerSearchSelectv2
                        {...field}
                        onChange={field.onChange}
                        value={field.value}
                        inputRef={initialFocusRef}
                        alertOnArticleEligibility
                        invalid={!!errors.serverId}
                        disabled={isSubmitting}
                        inputId="server-select"
                        ariaLabelledBy="server-select-label"
                      />
                    )}
                  />
                  <ChakraField.HelperText>
                    Only servers where you have server-wide Manage Channels permission will appear.
                    If you don&apos;t have this permission, you may ask someone who does to add the
                    feed and share it with you.
                  </ChakraField.HelperText>
                  <ChakraField.ErrorText>{errors.serverId?.message}</ChakraField.ErrorText>
                </ChakraField.Root>
                <ChakraField.Root invalid={!!errors.channelId} required>
                  <ChakraField.Label id="channel-select-label" htmlFor="channel-select">
                    {t(
                      "features.feed.components.addDiscordChannelConnectionDialog.formChannelLabel",
                    )}
                    <ChakraField.RequiredIndicator />
                  </ChakraField.Label>
                  <Controller
                    name="channelId"
                    control={control}
                    render={({ field }) => (
                      <DiscordChannelDropdown
                        isInvalid={!!errors.channelId}
                        value={field.value || ""}
                        onChange={(value, name, channelType) => {
                          field.onChange(value);
                          const isForum = channelType === "forum";
                          setIsForumChannel(isForum);

                          if (isForum) {
                            setValue("createThreadMethod", DiscordCreateChannelThreadMethod.None, {
                              shouldValidate: true,
                            });
                          }

                          setValue("threadId", undefined);

                          if (name) {
                            setValue("name", name, {
                              shouldDirty: true,
                              shouldTouch: true,
                              shouldValidate: true,
                            });
                          }
                        }}
                        onBlur={field.onBlur}
                        isDisabled={isSubmitting}
                        serverId={serverId}
                        inputId="channel-select"
                        ariaLabelledBy="channel-select-label"
                        types={[
                          GetDiscordChannelType.Text,
                          GetDiscordChannelType.Announcement,
                          GetDiscordChannelType.Forum,
                        ]}
                      />
                    )}
                  />
                  <ChakraField.ErrorText>{errors.channelId?.message}</ChakraField.ErrorText>
                </ChakraField.Root>
                {isForumChannel ? (
                  <ChakraField.Root>
                    <ChakraField.Label id="forum-thread-label">
                      Send to an existing thread
                    </ChakraField.Label>
                    <Controller
                      name="threadId"
                      control={control}
                      render={({ field }) => (
                        <DiscordActiveThreadDropdown
                          ariaLabelledBy="forum-thread-label"
                          isInvalid={false}
                          isClearable
                          inputId="forum-thread-select"
                          value={field.value || ""}
                          onChange={(value, name) => {
                            field.onChange(value);

                            if (name) {
                              setValue("name", name, {
                                shouldDirty: true,
                                shouldTouch: true,
                                shouldValidate: true,
                              });
                            }
                          }}
                          onBlur={field.onBlur}
                          isDisabled={isSubmitting}
                          serverId={serverId}
                          parentChannelId={channelId}
                          placeholder={
                            !channelId
                              ? "Must select a forum channel first"
                              : "Optionally select a thread"
                          }
                        />
                      )}
                    />
                    <ChakraField.HelperText>
                      By default, each article creates a new thread in this forum. Select a thread
                      here to send all articles to one thread instead.
                    </ChakraField.HelperText>
                  </ChakraField.Root>
                ) : (
                  <Controller
                    name="createThreadMethod"
                    control={control}
                    render={({ field: createThreadMethodField }) => (
                      <fieldset>
                        <ChakraField.Root required invalid={!!errors.createThreadMethod}>
                          <ChakraField.Label as="legend" id="thread-kind-label">
                            Thread behavior
                            <ChakraField.RequiredIndicator />
                          </ChakraField.Label>
                          <ChakraField.HelperText id="thread-kind-help" mb={2}>
                            Choose how articles are delivered to this channel
                          </ChakraField.HelperText>
                          <RadioGroup
                            onValueChange={(details) => {
                              createThreadMethodField.onChange(details.value);
                            }}
                            value={createThreadMethodField.value}
                            aria-labelledby="thread-kind-label"
                            aria-describedby="thread-kind-help"
                          >
                            <Stack>
                              <Radio value={DiscordCreateChannelThreadMethod.None}>
                                Send directly to channel
                              </Radio>
                              <Box>
                                <Radio
                                  value={DiscordCreateChannelThreadMethod.New}
                                  inputProps={{
                                    "aria-describedby":
                                      createThreadMethodField.value ===
                                      DiscordCreateChannelThreadMethod.New
                                        ? "new-thread-constraint"
                                        : undefined,
                                  }}
                                >
                                  Create a new thread for each new article
                                </Radio>
                                <Box
                                  aria-live="polite"
                                  aria-atomic="true"
                                  display={
                                    createThreadMethodField.value ===
                                    DiscordCreateChannelThreadMethod.New
                                      ? "block"
                                      : "none"
                                  }
                                  pl={4}
                                  ml={2}
                                  mt={2}
                                  borderLeft="solid 2px"
                                  borderColor="border.emphasized"
                                >
                                  <Alert.Root
                                    id="new-thread-constraint"
                                    status="info"
                                    fontSize="sm"
                                  >
                                    <Alert.Indicator />
                                    <Alert.Description>
                                      Messages in new threads will appear under the MonitoRSS name.
                                      The display name and avatar can&apos;t be customized with this
                                      option.
                                    </Alert.Description>
                                  </Alert.Root>
                                </Box>
                              </Box>
                              <Box>
                                <Radio
                                  value={DiscordCreateChannelThreadMethod.Existing}
                                  inputProps={{
                                    "aria-controls": "channel-thread-select-container",
                                    "aria-expanded":
                                      createThreadMethodField.value ===
                                      DiscordCreateChannelThreadMethod.Existing,
                                  }}
                                >
                                  Use an existing thread for each new article
                                </Radio>
                                <fieldset>
                                  <chakra.legend
                                    srOnly
                                    position="absolute"
                                    width="1px"
                                    height="1px"
                                    padding={0}
                                    margin="-1px"
                                    overflow="hidden"
                                    clip="rect(0, 0, 0, 0)"
                                    whiteSpace="nowrap"
                                    borderWidth={0}
                                  >
                                    Existing thread information
                                  </chakra.legend>
                                  <ChakraField.Root
                                    id="channel-thread-select-container"
                                    display={
                                      createThreadMethodField.value ===
                                      DiscordCreateChannelThreadMethod.Existing
                                        ? "flex"
                                        : "none"
                                    }
                                    invalid={!!errors.threadId}
                                    required={
                                      createThreadMethodField.value ===
                                      DiscordCreateChannelThreadMethod.Existing
                                    }
                                    pl={4}
                                    ml={2}
                                    mt={2}
                                    borderLeft="solid 2px"
                                    borderColor="border.emphasized"
                                  >
                                    <ChakraField.Label
                                      id="channel-thread-label"
                                      htmlFor="channel-thread-select"
                                    >
                                      Discord Channel Thread
                                      <ChakraField.RequiredIndicator />
                                    </ChakraField.Label>
                                    <Controller
                                      name="threadId"
                                      control={control}
                                      render={({ field }) => (
                                        <DiscordActiveThreadDropdown
                                          ariaLabelledBy="channel-thread-label"
                                          isInvalid={!!errors.threadId}
                                          inputId="channel-thread-select"
                                          value={field.value || ""}
                                          onChange={(value, name) => {
                                            field.onChange(value);

                                            if (name) {
                                              setValue("name", name, {
                                                shouldDirty: true,
                                                shouldTouch: true,
                                                shouldValidate: true,
                                              });
                                            }
                                          }}
                                          onBlur={field.onBlur}
                                          isDisabled={isSubmitting}
                                          serverId={serverId}
                                          parentChannelId={channelId}
                                        />
                                      )}
                                    />
                                    <ChakraField.ErrorText>
                                      {errors.threadId?.message}
                                    </ChakraField.ErrorText>
                                    <ChakraField.HelperText>
                                      {t(
                                        "features.feed.components" +
                                          ".addDiscordChannelThreadConnectionDialog.formThreadDescripton",
                                      )}
                                    </ChakraField.HelperText>
                                  </ChakraField.Root>
                                </fieldset>
                              </Box>
                            </Stack>
                          </RadioGroup>
                        </ChakraField.Root>
                      </fieldset>
                    )}
                  />
                )}
                <ChakraField.Root invalid={!!errors.name} required>
                  <ChakraField.Label>
                    {t(
                      "features.feed.components.addDiscordChannelThreadConnectionDialog.formNameLabel",
                    )}
                    <ChakraField.RequiredIndicator />
                  </ChakraField.Label>
                  <Controller
                    name="name"
                    control={control}
                    render={({ field }) => <Input {...field} value={field.value || ""} />}
                  />
                  {errors.name && (
                    <ChakraField.ErrorText>{errors.name.message}</ChakraField.ErrorText>
                  )}
                  <ChakraField.HelperText>
                    {t(
                      "features.feed.components" +
                        ".addDiscordChannelThreadConnectionDialog.formNameDescription",
                    )}
                  </ChakraField.HelperText>
                </ChakraField.Root>
                {isEditing && (
                  <fieldset>
                    <chakra.legend fontWeight="semibold" fontSize="md" mb={2}>
                      Branding
                    </chakra.legend>
                    {!brandingAllowed && (
                      <Text fontSize="sm" color="text.warning" mb={2}>
                        Upgrade to a paid plan to use custom branding on this connection.
                      </Text>
                    )}
                    <Stack gap={4} opacity={!brandingAllowed ? 0.5 : 1}>
                      <ChakraField.Root disabled={!brandingAllowed || !!brandingDisabledReason}>
                        <ChakraField.Label>Display Name</ChakraField.Label>
                        <Controller
                          name="brandingDisplayName"
                          control={control}
                          render={({ field }) => (
                            <Input
                              {...field}
                              value={field.value || ""}
                              placeholder="Optional"
                              disabled={!brandingAllowed || !!brandingDisabledReason}
                            />
                          )}
                        />
                        <ChakraField.HelperText>
                          The display name that will appear on delivered messages.
                        </ChakraField.HelperText>
                      </ChakraField.Root>
                      <ChakraField.Root disabled={!brandingAllowed || !!brandingDisabledReason}>
                        <ChakraField.Label>Avatar URL</ChakraField.Label>
                        <Controller
                          name="brandingAvatarUrl"
                          control={control}
                          render={({ field }) => (
                            <Input
                              {...field}
                              value={field.value || ""}
                              placeholder="Optional"
                              type="url"
                              disabled={!brandingAllowed || !!brandingDisabledReason}
                            />
                          )}
                        />
                        <ChakraField.HelperText>
                          A URL for the avatar image that will appear on delivered messages.
                        </ChakraField.HelperText>
                      </ChakraField.Root>
                    </Stack>
                    {brandingDisabledReason && (
                      <Text fontSize="sm" color="fg.muted" mt={2}>
                        {brandingDisabledReason}
                      </Text>
                    )}
                  </fieldset>
                )}
              </Stack>
            </form>
            <ConnectionDialogErrorDisplay
              error={submissionError}
              isSubmitted={isSubmitted}
              formErrorCount={errorCount}
            />
          </Stack>
        </DialogBody>
        <DialogFooter>
          <HStack>
            <Button variant="ghost" mr={3} onClick={handleClose} disabled={isSubmitting}>
              <span>{t("common.buttons.cancel")}</span>
            </Button>
            {connection ? (
              <PrimaryActionButton
                type="submit"
                form="add-text-channel-connection"
                loading={isSubmitting}
                aria-disabled={isSubmitting || !isValid}
              >
                <span>{t("common.buttons.save")}</span>
              </PrimaryActionButton>
            ) : (
              <PrimaryActionButton onClick={handleNextStep} disabled={isSubmitting}>
                <span>Next: Choose Template</span>
              </PrimaryActionButton>
            )}
          </HStack>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
};
