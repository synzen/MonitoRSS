/* eslint-disable no-nested-ternary */
import {
  Alert,
  AlertDescription,
  AlertIcon,
  Box,
  Button,
  FormControl,
  FormErrorMessage,
  FormHelperText,
  FormLabel,
  HStack,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Radio,
  RadioGroup,
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
import { FeedDiscordChannelConnection } from "../../../../types";
import {
  DiscordActiveThreadDropdown,
  DiscordChannelDropdown,
  DiscordServerSearchSelectv2,
  GetDiscordChannelType,
} from "../../../discordServers";
import { usePageAlertContext } from "../../../../contexts/PageAlertContext";
import {
  TEMPLATES,
  DEFAULT_TEMPLATE,
  getTemplateById,
} from "../../../templates/constants/templates";
import { TemplateGalleryModal } from "../../../templates/components/TemplateGalleryModal";
import convertMessageBuilderStateToConnectionUpdate from "../../../../pages/MessageBuilder/utils/convertMessageBuilderStateToConnectionUpdate";
import { ConnectionDialogErrorDisplay } from "./ConnectionDialogErrorDisplay";

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
  const type = connection?.details.channel?.type;
  return type === "forum" || type === "forum-thread";
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

  const defaultFormValues: Partial<FormData> = isForumChannel
    ? {
        name: connection?.name,
        serverId: connection?.details.channel?.guildId,
        channelId: connection?.details.channel?.parentChannelId || connection?.details.channel?.id,
        threadId: connection?.details.channel?.parentChannelId
          ? connection?.details.channel?.id
          : undefined,
        createThreadMethod: DiscordCreateChannelThreadMethod.None,
      }
    : {
        name: connection?.name,
        channelId: connection?.details.channel?.parentChannelId || connection?.details.channel?.id,
        serverId: connection?.details.channel?.guildId,
        threadId:
          connection?.details.channel?.type === "thread"
            ? connection?.details.channel?.id
            : undefined,
        createThreadMethod:
          connection?.details.channel?.type === "new-thread"
            ? DiscordCreateChannelThreadMethod.New
            : connection?.details.channel?.type === "thread"
              ? DiscordCreateChannelThreadMethod.Existing
              : DiscordCreateChannelThreadMethod.None,
      };

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
    mode: "all",
    defaultValues: defaultFormValues,
  });
  const [serverId, channelId, watchedThreadId, watchedCreateThreadMethod] = watch([
    "serverId",
    "channelId",
    "threadId",
    "createThreadMethod",
  ]);
  const { mutateAsync, error } = useCreateDiscordChannelConnection();
  const { mutateAsync: updateMutateAsync, error: updateError } =
    useUpdateDiscordChannelConnection();
  const initialFocusRef = useRef<any>(null);
  const { createSuccessAlert } = usePageAlertContext();

  // Shared callbacks from hook
  const { onSaveSuccess } = useConnectionDialogCallbacks();

  // Create connection callback for test send flow
  const createConnection = useCallback(
    async (branding?: { name: string; iconUrl?: string }): Promise<void> => {
      if (!feedId) {
        throw new Error("Feed ID missing");
      }

      const formValues = watch();
      const { name, createThreadMethod, channelId: inputChannelId, threadId } = formValues;

      // Get template data to include in create call
      const templateData = getTemplateUpdateData(selectedTemplateId, detectedFields);

      await mutateAsync({
        feedId,
        details: {
          name,
          ...(branding?.name
            ? {
                applicationWebhook: {
                  channelId: threadId || inputChannelId,
                  name: branding.name,
                  iconUrl: branding.iconUrl,
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
    onClose,
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
  }: FormData) => {
    if (!feedId) {
      throw new Error("Feed ID missing while creating discord channel connection");
    }

    if (connection) {
      try {
        if (isForumChannel) {
          if (threadId) {
            await updateMutateAsync({
              feedId,
              connectionId: connection.id,
              details: {
                channelId: threadId,
              },
            });
          } else {
            await updateMutateAsync({
              feedId,
              connectionId: connection.id,
              details: {
                name,
                channelId: inputChannelId,
              },
            });
          }
        } else {
          await updateMutateAsync({
            feedId,
            connectionId: connection.id,
            details: {
              name,
              channelId:
                createThreadMethod === DiscordCreateChannelThreadMethod.Existing && threadId
                  ? threadId
                  : inputChannelId,
              threadCreationMethod:
                createThreadMethod === DiscordCreateChannelThreadMethod.New
                  ? "new-thread"
                  : undefined,
            },
          });
        }

        createSuccessAlert({
          title: "Successfully updated connection.",
        });
        onClose();
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
      onClose();
    } catch (err) {
      // Error handled by mutation error state
    }
  };

  useEffect(() => {
    reset();
    setIsForumChannel(getIsForumConnection(connection));
  }, [isOpen]);

  const handleNextStep = async () => {
    const fieldsToValidate: (keyof FormData)[] = isForumChannel
      ? ["serverId", "channelId", "name"]
      : ["serverId", "channelId", "name", "createThreadMethod", "threadId"];

    const isServerChannelValid = await trigger(fieldsToValidate);

    if (isServerChannelValid) {
      templateHandleNextStep();
    }
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
        isOpen={isOpen}
        onClose={onClose}
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
        onTertiaryAction={handleBackStep}
        onCancel={onClose}
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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      closeOnOverlayClick={!isSubmitting}
      initialFocusRef={initialFocusRef}
      finalFocusRef={finalFocusRef}
    >
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>
          {connection ? "Edit Discord Connection" : "Add Discord Connection"}
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Stack spacing={4}>
            <Text>Send articles as a message to a Discord channel or forum.</Text>
            <form id="add-text-channel-connection" onSubmit={handleSubmit(onSubmit)}>
              <Stack spacing={6}>
                <FormControl isInvalid={!!errors.serverId} isRequired>
                  <FormLabel id="server-select-label" htmlFor="server-select">
                    {t(
                      "features.feed.components.addDiscordChannelConnectionDialog.formServerLabel",
                    )}
                  </FormLabel>
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
                        isInvalid={!!errors.serverId}
                        isDisabled={isSubmitting}
                        inputId="server-select"
                        ariaLabelledBy="server-select-label"
                      />
                    )}
                  />
                  <FormHelperText>
                    Only servers where you have server-wide Manage Channels permission will appear.
                    If you don&apos;t have this permission, you may ask someone who does to add the
                    feed and share it with you.
                  </FormHelperText>
                  <FormErrorMessage>{errors.serverId?.message}</FormErrorMessage>
                </FormControl>
                <FormControl isInvalid={!!errors.channelId} isRequired>
                  <FormLabel id="channel-select-label" htmlFor="channel-select">
                    {t(
                      "features.feed.components.addDiscordChannelConnectionDialog.formChannelLabel",
                    )}
                  </FormLabel>
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
                  <FormErrorMessage>{errors.channelId?.message}</FormErrorMessage>
                </FormControl>
                {isForumChannel ? (
                  <FormControl>
                    <FormLabel id="forum-thread-label">Existing Forum Thread</FormLabel>
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
                    <FormHelperText>
                      Optionally specify an existing thread that new articles should be sent to
                      rather than creating new threads.
                    </FormHelperText>
                  </FormControl>
                ) : (
                  <Controller
                    name="createThreadMethod"
                    control={control}
                    render={({ field: createThreadMethodField }) => (
                      <fieldset>
                        <FormControl isRequired isInvalid={!!errors.createThreadMethod}>
                          <FormLabel as="legend" id="thread-kind-label">
                            How should threads be used?
                          </FormLabel>
                          <FormHelperText id="thread-kind-help" mb={2}>
                            Select one option
                          </FormHelperText>
                          <RadioGroup
                            onChange={(value) => {
                              createThreadMethodField.onChange(value);
                            }}
                            value={createThreadMethodField.value}
                            aria-labelledby="thread-kind-label"
                            aria-describedby="thread-kind-help"
                          >
                            <Stack>
                              <Radio value={DiscordCreateChannelThreadMethod.None}>
                                Don&apos;t use threads
                              </Radio>
                              <Radio
                                value={DiscordCreateChannelThreadMethod.New}
                                aria-describedby={
                                  createThreadMethodField.value ===
                                  DiscordCreateChannelThreadMethod.New
                                    ? "new-thread-constraint"
                                    : undefined
                                }
                              >
                                Create a new thread for each new article
                              </Radio>
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
                                  <chakra.legend srOnly>Existing thread information</chakra.legend>
                                  <FormControl
                                    id="channel-thread-select-container"
                                    display={
                                      createThreadMethodField.value ===
                                      DiscordCreateChannelThreadMethod.Existing
                                        ? "block"
                                        : "none"
                                    }
                                    isInvalid={!!errors.threadId}
                                    isRequired={
                                      createThreadMethodField.value ===
                                      DiscordCreateChannelThreadMethod.Existing
                                    }
                                    pl={4}
                                    ml={2}
                                    mt={2}
                                    borderLeft="solid 2px"
                                    borderColor="gray.600"
                                  >
                                    <FormLabel
                                      id="channel-thread-label"
                                      htmlFor="channel-thread-select"
                                    >
                                      Discord Channel Thread
                                    </FormLabel>
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
                                    <FormErrorMessage>{errors.threadId?.message}</FormErrorMessage>
                                    <FormHelperText>
                                      {t(
                                        "features.feed.components" +
                                          ".addDiscordChannelThreadConnectionDialog.formThreadDescripton",
                                      )}
                                    </FormHelperText>
                                  </FormControl>
                                </fieldset>
                              </Box>
                            </Stack>
                          </RadioGroup>
                          <Box aria-live="polite" aria-atomic="true" mt={2}>
                            {createThreadMethodField.value ===
                              DiscordCreateChannelThreadMethod.New && (
                              <Alert
                                id="new-thread-constraint"
                                status="info"
                                variant="left-accent"
                                fontSize="sm"
                                borderRadius="md"
                              >
                                <AlertIcon />
                                <AlertDescription>
                                  Messages in new threads will appear under the MonitoRSS name. The
                                  display name and avatar can&apos;t be customized with this option.
                                </AlertDescription>
                              </Alert>
                            )}
                          </Box>
                        </FormControl>
                      </fieldset>
                    )}
                  />
                )}
                <FormControl isInvalid={!!errors.name} isRequired>
                  <FormLabel>
                    {t(
                      "features.feed.components.addDiscordChannelThreadConnectionDialog.formNameLabel",
                    )}
                  </FormLabel>
                  <Controller
                    name="name"
                    control={control}
                    render={({ field }) => (
                      <Input {...field} value={field.value || ""} bg="gray.800" />
                    )}
                  />
                  {errors.name && <FormErrorMessage>{errors.name.message}</FormErrorMessage>}
                  <FormHelperText>
                    {t(
                      "features.feed.components" +
                        ".addDiscordChannelThreadConnectionDialog.formNameDescription",
                    )}
                  </FormHelperText>
                </FormControl>
              </Stack>
            </form>
            <ConnectionDialogErrorDisplay
              error={submissionError}
              isSubmitted={isSubmitted}
              formErrorCount={errorCount}
            />
          </Stack>
        </ModalBody>
        <ModalFooter>
          <HStack>
            <Button variant="ghost" mr={3} onClick={onClose} isDisabled={isSubmitting}>
              <span>{t("common.buttons.cancel")}</span>
            </Button>
            {connection ? (
              <Button
                colorScheme="blue"
                type="submit"
                form="add-text-channel-connection"
                isLoading={isSubmitting}
                aria-disabled={isSubmitting || !isValid}
              >
                <span>{t("common.buttons.save")}</span>
              </Button>
            ) : (
              <Button colorScheme="blue" onClick={handleNextStep} isDisabled={isSubmitting}>
                <span>Next: Choose Template</span>
              </Button>
            )}
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
