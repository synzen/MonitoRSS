import {
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
  Stack,
  Text,
} from "@chakra-ui/react";
import { yupResolver } from "@hookform/resolvers/yup";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { InferType, object, string } from "yup";
import { useEffect, useRef, useCallback } from "react";

import RouteParams from "../../../../types/RouteParams";
import {
  useCreateDiscordChannelConnection,
  useConnectionTemplateSelection,
  useTestSendFlow,
  getTemplateUpdateData,
  useConnectionDialogCallbacks,
} from "../../hooks";
import {
  DiscordActiveThreadDropdown,
  DiscordChannelDropdown,
  DiscordServerSearchSelectv2,
  GetDiscordChannelType,
} from "../../../discordServers";
import { SubscriberBlockText } from "@/components/SubscriberBlockText";
import { BlockableFeature, SupporterTier } from "../../../../constants";
import { usePageAlertContext } from "../../../../contexts/PageAlertContext";
import { useIsFeatureAllowed } from "../../../../hooks";
import {
  TEMPLATES,
  DEFAULT_TEMPLATE,
  getTemplateById,
} from "../../../templates/constants/templates";
import { TemplateGalleryModal } from "../../../templates/components/TemplateGalleryModal";
import convertMessageBuilderStateToConnectionUpdate from "../../../../pages/MessageBuilder/utils/convertMessageBuilderStateToConnectionUpdate";
import { ConnectionDialogErrorDisplay } from "./ConnectionDialogErrorDisplay";

const formSchema = object({
  name: string().required("Name is required").max(250, "Name must be less than 250 characters"),
  serverId: string().required("Server ID is required"),
  channelId: string().required("Channel ID is required"),
  threadId: string().optional(),
  webhook: object({
    name: string().required("Webhook name is required"),
    iconUrl: string().optional(),
  }),
});

interface Props {
  onClose: () => void;
  isOpen: boolean;
}

type FormData = InferType<typeof formSchema>;

export const DiscordApplicationWebhookConnectionDialogContent: React.FC<Props> = ({
  onClose,
  isOpen,
}) => {
  const { feedId } = useParams<RouteParams>();
  const { t } = useTranslation();

  // Template selection state (webhook is always creating, not editing)
  const {
    isTemplateStep,
    selectedTemplateId,
    setSelectedTemplateId,
    selectedArticleId,
    setSelectedArticleId,
    userFeed,
    articles,
    feedFields,
    detectedImageField,
    isLoadingArticles,
    handleNextStep: templateHandleNextStep,
    handleBackStep,
  } = useConnectionTemplateSelection({ isOpen, isEditing: false });

  const {
    handleSubmit,
    control,
    reset,
    trigger,
    watch,
    setValue,
    formState: { errors, isSubmitting, isValid, isSubmitted },
  } = useForm<FormData>({
    resolver: yupResolver(formSchema),
    mode: "all",
  });
  const [serverId, channelId, threadId, webhookData] = watch([
    "serverId",
    "channelId",
    "threadId",
    "webhook",
  ]);
  const { mutateAsync, error } = useCreateDiscordChannelConnection();
  const { createSuccessAlert } = usePageAlertContext();
  const { allowed } = useIsFeatureAllowed({ feature: BlockableFeature.DiscordWebhooks });
  const initialFocusRef = useRef<any>(null);

  // Shared callbacks from hook
  const { onSaveSuccess } = useConnectionDialogCallbacks();

  // Create connection callback for test send flow
  const createConnection = useCallback(async (): Promise<string | undefined> => {
    if (!feedId) {
      throw new Error("Feed ID missing");
    }

    const formValues = watch();
    const { name, webhook, threadId: inputThreadId } = formValues;

    // Get template data to include in create call
    const templateData = getTemplateUpdateData(selectedTemplateId, detectedImageField || "image");

    const createResult = await mutateAsync({
      feedId,
      details: {
        name,
        applicationWebhook: {
          channelId,
          name: webhook.name,
          iconUrl: webhook.iconUrl,
          threadId: inputThreadId,
        },
        content: templateData.content,
        embeds: templateData.embeds,
        componentsV2: templateData.componentsV2,
        placeholderLimits: templateData.placeholderLimits,
      },
    });

    return createResult?.result?.id;
  }, [feedId, watch, mutateAsync, selectedTemplateId, channelId, detectedImageField]);

  // Get connection name from form
  const getConnectionName = useCallback(() => watch("name"), [watch]);

  // Determine the effective channel ID for test send
  const testSendChannelId = threadId || channelId;

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
    webhookName: webhookData?.name,
    webhookIconUrl: webhookData?.iconUrl,
    selectedTemplateId,
    selectedArticleId,
    detectedImageField,
    isOpen,
    createConnection,
    onSaveSuccess,
    onClose,
    getConnectionName,
  });

  const handleNextStep = async () => {
    const isFormValid = await trigger(["serverId", "channelId", "name", "webhook"]);

    if (isFormValid) {
      templateHandleNextStep();
    }
  };

  const onSubmit = async ({ threadId: inputThreadId, name, webhook }: FormData) => {
    if (!feedId) {
      throw new Error("Feed ID missing while creating discord channel connection");
    }

    try {
      // Get the template to apply (selected or default)
      const templateToApply = selectedTemplateId
        ? getTemplateById(selectedTemplateId) || DEFAULT_TEMPLATE
        : DEFAULT_TEMPLATE;

      // Create message component with detected image field and convert to API format
      const messageComponent = templateToApply.createMessageComponent(
        detectedImageField || "image"
      );
      const templateData = convertMessageBuilderStateToConnectionUpdate(messageComponent);

      // Create the connection with template data in a single atomic operation
      await mutateAsync({
        feedId,
        details: {
          name,
          applicationWebhook: {
            channelId,
            name: webhook.name,
            iconUrl: webhook.iconUrl,
            threadId: inputThreadId,
          },
          content: templateData.content,
          embeds: templateData.embeds,
          componentsV2: templateData.componentsV2,
          placeholderLimits: templateData.placeholderLimits,
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
  }, [isOpen]);

  const errorCount = Object.keys(errors).length;

  // For template selection step, show TemplateGalleryModal instead of regular modal
  if (isTemplateStep) {
    return (
      <TemplateGalleryModal
        isOpen={isOpen}
        onClose={onClose}
        templates={TEMPLATES}
        selectedTemplateId={selectedTemplateId}
        onTemplateSelect={setSelectedTemplateId}
        feedFields={feedFields}
        detectedImageField={detectedImageField}
        articles={articles.map((a) => ({
          id: a.id,
          title: (a as Record<string, unknown>).title as string | undefined,
        }))}
        selectedArticleId={selectedArticleId}
        onArticleChange={setSelectedArticleId}
        isLoadingArticles={isLoadingArticles}
        feedId={feedId || ""}
        userFeed={userFeed}
        tertiaryActionLabel="← Back to Channel"
        onTertiaryAction={handleBackStep}
        onCancel={onClose}
        testId="webhook-template-selection-modal"
        onTestSend={handleTestSend}
        isTestSendLoading={isTestSending}
        testSendFeedback={testSendFeedback}
        onClearTestSendFeedback={clearTestSendFeedback}
        onSave={handleSave}
        isSaveLoading={isSaving || isSubmitting}
        saveError={error}
      />
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      closeOnOverlayClick={!isSubmitting}
      initialFocusRef={initialFocusRef}
    >
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Add a Discord webhook connection</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Stack spacing={4}>
            <Text>
              Send articles authored by a webhook with a custom name and icon as a message to a
              Discord channel or thread.
            </Text>
            <SubscriberBlockText
              feature={BlockableFeature.DiscordWebhooks}
              supporterTier={SupporterTier.Any}
              onClick={onClose}
            />
            <form id="addconnection" onSubmit={handleSubmit(onSubmit)} hidden={!allowed}>
              <Stack spacing={4}>
                <FormControl isInvalid={!!errors.serverId} isRequired>
                  <FormLabel id="server-select-label" htmlFor="server-select">
                    {t(
                      "features.feed.components.addDiscordWebhookConnectionDialog.formServerLabel"
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
                        isDisabled={isSubmitting}
                        alertOnArticleEligibility
                        isInvalid={!!errors.serverId}
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
                    Channel
                  </FormLabel>
                  <Controller
                    name="channelId"
                    control={control}
                    render={({ field }) => (
                      <DiscordChannelDropdown
                        isInvalid={!!errors.channelId}
                        value={field.value || ""}
                        onChange={(value, name) => {
                          field.onChange(value);

                          if (name && !threadId) {
                            setValue("name", name, {
                              shouldDirty: true,
                              shouldTouch: true,
                              shouldValidate: true,
                            });
                            setValue("webhook.name", name, {
                              shouldDirty: true,
                              shouldTouch: true,
                              shouldValidate: true,
                            });
                          }
                        }}
                        types={[
                          GetDiscordChannelType.Text,
                          GetDiscordChannelType.Forum,
                          GetDiscordChannelType.Announcement,
                        ]}
                        onBlur={field.onBlur}
                        isDisabled={isSubmitting}
                        serverId={serverId}
                        inputId="channel-select"
                        ariaLabelledBy="channel-select-label"
                      />
                    )}
                  />
                  {errors.channelId && (
                    <FormErrorMessage>{errors.channelId?.message}</FormErrorMessage>
                  )}
                </FormControl>
                <FormControl isInvalid={!!errors.threadId?.message}>
                  <FormLabel id="forum-thread-label" htmlFor="forum-thread-select">
                    Forum Thread
                  </FormLabel>
                  <Controller
                    name="threadId"
                    control={control}
                    render={({ field }) => (
                      <DiscordActiveThreadDropdown
                        value={field.value || ""}
                        ariaLabelledBy="forum-thread-label"
                        isInvalid={!!errors.threadId}
                        inputId="forum-thread-select"
                        onChange={(value, name) => {
                          field.onChange(value);

                          if (name) {
                            setValue("name", name, {
                              shouldDirty: true,
                              shouldTouch: true,
                              shouldValidate: true,
                            });
                            setValue("webhook.name", name, {
                              shouldDirty: true,
                              shouldTouch: true,
                              shouldValidate: true,
                            });
                          }
                        }}
                        onBlur={field.onBlur}
                        isDisabled={isSubmitting}
                        isClearable
                        serverId={serverId}
                        parentChannelId={channelId}
                      />
                    )}
                  />
                  {errors.threadId && (
                    <FormErrorMessage>{errors.threadId?.message}</FormErrorMessage>
                  )}
                  {!errors.threadId && (
                    <FormHelperText>
                      If specified, all messages will go into a specific thread. Only unlocked
                      (unarchived) threads are listed.
                    </FormHelperText>
                  )}
                </FormControl>
                <FormControl isInvalid={!!errors.webhook?.name} isRequired>
                  <FormLabel>
                    {t(
                      "features.feed.components.addDiscordWebhookConnectionDialog.webhookNameLabel"
                    )}
                  </FormLabel>
                  <Controller
                    name="webhook.name"
                    control={control}
                    render={({ field }) => (
                      <Input
                        {...field}
                        isDisabled={isSubmitting}
                        value={field.value || ""}
                        bg="gray.800"
                      />
                    )}
                  />
                  {errors.webhook?.name && (
                    <FormErrorMessage>{errors.webhook.name.message}</FormErrorMessage>
                  )}
                  {!errors.webhook?.name && (
                    <FormHelperText>The username the webhook will use</FormHelperText>
                  )}
                </FormControl>
                <FormControl isInvalid={!!errors.webhook?.iconUrl}>
                  <FormLabel>
                    {t(
                      "features.feed.components.addDiscordWebhookConnectionDialog" +
                        ".webhookIconUrlLabel"
                    )}
                  </FormLabel>
                  <Controller
                    name="webhook.iconUrl"
                    control={control}
                    render={({ field }) => (
                      <Input
                        placeholder="Optional"
                        {...field}
                        isDisabled={isSubmitting}
                        value={field.value || ""}
                        bg="gray.800"
                      />
                    )}
                  />
                  {errors.webhook?.iconUrl && (
                    <FormErrorMessage>{errors.webhook.iconUrl.message}</FormErrorMessage>
                  )}
                </FormControl>
                <FormControl isInvalid={!!errors.name} isRequired>
                  <FormLabel>
                    {t(
                      "features.feed.components.addDiscordChannelThreadConnectionDialog.formNameLabel"
                    )}
                  </FormLabel>
                  <Controller
                    name="name"
                    control={control}
                    render={({ field }) => (
                      <Input
                        {...field}
                        value={field.value || ""}
                        bg="gray.800"
                        isDisabled={isSubmitting}
                      />
                    )}
                  />
                  {errors.name && <FormErrorMessage>{errors.name.message}</FormErrorMessage>}
                  {!errors.name && (
                    <FormHelperText>
                      {t(
                        "features.feed.components" +
                          ".addDiscordChannelThreadConnectionDialog.formNameDescription"
                      )}
                    </FormHelperText>
                  )}
                </FormControl>
              </Stack>
            </form>
            <ConnectionDialogErrorDisplay
              error={error}
              isSubmitted={isSubmitted}
              formErrorCount={errorCount}
            />
          </Stack>
        </ModalBody>
        <ModalFooter>
          {allowed && (
            <HStack>
              <Button variant="ghost" mr={3} onClick={onClose} isDisabled={isSubmitting}>
                <span>{t("common.buttons.cancel")}</span>
              </Button>
              <Button colorScheme="blue" onClick={handleNextStep} isDisabled={isSubmitting}>
                <span>Next: Choose Template</span>
              </Button>
            </HStack>
          )}
          {!allowed && (
            <Button onClick={onClose}>
              <span>Close</span>
            </Button>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
