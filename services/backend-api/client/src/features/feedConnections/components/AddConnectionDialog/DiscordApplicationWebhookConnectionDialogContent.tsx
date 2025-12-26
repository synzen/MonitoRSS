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
import { useEffect, useRef } from "react";

import RouteParams from "../../../../types/RouteParams";
import {
  useCreateDiscordChannelConnection,
  useUpdateDiscordChannelConnection,
  useConnectionTemplateSelection,
  convertTemplateToUpdateDetails,
} from "../../hooks";
import {
  DiscordActiveThreadDropdown,
  DiscordChannelDropdown,
  DiscordServerSearchSelectv2,
  GetDiscordChannelType,
} from "../../../discordServers";
import { SubscriberBlockText } from "@/components/SubscriberBlockText";
import { BlockableFeature, SupporterTier } from "../../../../constants";
import { InlineErrorAlert, InlineErrorIncompleteFormAlert } from "../../../../components";
import { usePageAlertContext } from "../../../../contexts/PageAlertContext";
import { useIsFeatureAllowed } from "../../../../hooks";
import { TemplateGalleryModal } from "../../../templates/components/TemplateGalleryModal";
import { TEMPLATES, DEFAULT_TEMPLATE, getTemplateById } from "../../../templates/constants/templates";

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
  const [serverId, channelId, threadId] = watch(["serverId", "channelId", "threadId"]);
  const { mutateAsync, error } = useCreateDiscordChannelConnection();
  const { mutateAsync: updateMutateAsync, error: updateError } =
    useUpdateDiscordChannelConnection();
  const { createSuccessAlert } = usePageAlertContext();
  const { allowed } = useIsFeatureAllowed({ feature: BlockableFeature.DiscordWebhooks });
  const initialFocusRef = useRef<any>(null);

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
      // Create the connection first
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
        },
      });

      // Get the template to apply (selected or default)
      const templateToApply = selectedTemplateId
        ? getTemplateById(selectedTemplateId) || DEFAULT_TEMPLATE
        : DEFAULT_TEMPLATE;

      // Apply template to the connection
      if (createResult?.result?.id) {
        const newConnectionId = createResult.result.id;

        // Convert template messageComponent to API format
        const templateData = convertTemplateToUpdateDetails(templateToApply);

        // Update the connection with template data
        await updateMutateAsync({
          feedId,
          connectionId: newConnectionId,
          details: {
            content: templateData.content,
            embeds: templateData.embeds,
            componentsV2: templateData.componentsV2,
            placeholderLimits: templateData.placeholderLimits,
          },
        });
      }

      createSuccessAlert({
        title: "Successfully added connection",
        description: "New articles will be delivered automatically when found.",
      });
      onClose();
    } catch (err) {}
  };

  useEffect(() => {
    reset();
  }, [isOpen]);

  const errorCount = Object.keys(errors).length;

  const useError = error || updateError;

  // For template selection step, show TemplateGalleryModal instead of regular modal
  if (isTemplateStep) {
    return (
      <TemplateGalleryModal
        isOpen={isOpen}
        onClose={handleBackStep}
        templates={TEMPLATES}
        selectedTemplateId={selectedTemplateId}
        onTemplateSelect={setSelectedTemplateId}
        feedFields={feedFields}
        articles={articles.map((a) => ({
          id: a.id,
          title: (a as Record<string, unknown>).title as string | undefined,
        }))}
        selectedArticleId={selectedArticleId}
        onArticleChange={setSelectedArticleId}
        feedId={feedId || ""}
        userFeed={userFeed}
        primaryActionLabel="Continue"
        onPrimaryAction={(templateId) => {
          setSelectedTemplateId(templateId);
          handleSubmit(onSubmit)();
        }}
        isPrimaryActionLoading={isSubmitting}
        secondaryActionLabel="Skip"
        onSecondaryAction={() => {
          setSelectedTemplateId(undefined);
          handleSubmit(onSubmit)();
        }}
        tertiaryActionLabel="Back"
        onTertiaryAction={handleBackStep}
        testId="webhook-template-selection-modal"
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
            {useError && (
              <InlineErrorAlert
                title={t("common.errors.somethingWentWrong")}
                description={useError.message}
              />
            )}
            {isSubmitted && errorCount > 0 && (
              <InlineErrorIncompleteFormAlert fieldCount={errorCount} />
            )}
          </Stack>
        </ModalBody>
        <ModalFooter>
          {allowed && (
            <HStack>
              <Button variant="ghost" mr={3} onClick={onClose} isDisabled={isSubmitting}>
                <span>{t("common.buttons.cancel")}</span>
              </Button>
              <Button colorScheme="blue" onClick={handleNextStep} isDisabled={isSubmitting}>
                <span>Next</span>
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
