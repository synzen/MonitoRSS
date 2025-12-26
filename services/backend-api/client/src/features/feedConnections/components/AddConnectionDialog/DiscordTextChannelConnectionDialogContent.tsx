/* eslint-disable no-nested-ternary */
import {
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
import { useEffect, useRef } from "react";
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
import { InlineErrorAlert, InlineErrorIncompleteFormAlert } from "../../../../components";
import { FeedDiscordChannelConnection } from "../../../../types";
import { usePageAlertContext } from "../../../../contexts/PageAlertContext";
import { TemplateGalleryModal } from "../../../templates/components/TemplateGalleryModal";
import { TEMPLATES, DEFAULT_TEMPLATE, getTemplateById } from "../../../templates/constants/templates";

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
}

type FormData = InferType<typeof formSchema>;

export const DiscordTextChannelConnectionDialogContent: React.FC<Props> = ({
  onClose,
  isOpen,
  connection,
}) => {
  const isEditing = !!connection;

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
    handleNextStep: templateHandleNextStep,
    handleBackStep,
  } = useConnectionTemplateSelection({ isOpen, isEditing });

  const defaultFormValues: Partial<FormData> = {
    name: connection?.name,
    channelId: connection?.details.channel?.parentChannelId || connection?.details.channel?.id,
    serverId: connection?.details.channel?.guildId,
    threadId:
      connection?.details.channel?.type === "thread" ? connection?.details.channel?.id : undefined,
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
  const [serverId, channelId] = watch(["serverId", "channelId"]);
  const { mutateAsync, error } = useCreateDiscordChannelConnection();
  const { mutateAsync: updateMutateAsync, error: updateError } =
    useUpdateDiscordChannelConnection();
  const initialFocusRef = useRef<any>(null);
  const { createSuccessAlert } = usePageAlertContext();

  useEffect(() => {
    if (connection) {
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

        createSuccessAlert({
          title: "Successfully updated connection.",
        });
        onClose();
      } catch (err) {}

      return;
    }

    try {
      // Create the connection first
      const createResult = await mutateAsync({
        feedId,
        details: {
          name,
          channelId: threadId || inputChannelId,
          threadCreationMethod:
            createThreadMethod === DiscordCreateChannelThreadMethod.New ? "new-thread" : undefined,
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
        title: "Successfully added connection.",
        description: "New articles will be delivered automatically when found.",
      });
      onClose();
    } catch (err) {}
  };

  useEffect(() => {
    reset();
  }, [isOpen]);

  const handleNextStep = async () => {
    const isServerChannelValid = await trigger([
      "serverId",
      "channelId",
      "name",
      "createThreadMethod",
      "threadId",
    ]);

    if (isServerChannelValid) {
      templateHandleNextStep();
    }
  };

  const errorCount = Object.keys(errors).length;

  const submissionError = error || updateError;

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
        testId="template-selection-modal"
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
        <ModalHeader>
          {connection ? "Edit Discord Channel Connection" : "Add Discord Channel Connection"}
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Stack spacing={4}>
            <Text>Send articles authored by the bot as a message to a Discord channel.</Text>
            <form id="addfeed" onSubmit={handleSubmit(onSubmit)}>
              <Stack spacing={6}>
                <FormControl isInvalid={!!errors.serverId} isRequired>
                  <FormLabel id="server-select-label" htmlFor="server-select">
                    {t(
                      "features.feed.components.addDiscordChannelConnectionDialog.formServerLabel"
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
                      "features.feed.components.addDiscordChannelConnectionDialog.formChannelLabel"
                    )}
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
                        types={[GetDiscordChannelType.Text, GetDiscordChannelType.Announcement]}
                      />
                    )}
                  />
                  <FormErrorMessage>{errors.channelId?.message}</FormErrorMessage>
                </FormControl>
                <Controller
                  name="createThreadMethod"
                  control={control}
                  render={({ field: createThreadMethodField }) => (
                    <fieldset aria-describedby="thread-kind-help">
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
                        >
                          <Stack>
                            <Radio value={DiscordCreateChannelThreadMethod.None}>
                              Don&apos;t use threads
                            </Radio>
                            <Radio value={DiscordCreateChannelThreadMethod.New}>
                              Create a new thread for each new article
                            </Radio>
                            <Box>
                              <Radio
                                value={DiscordCreateChannelThreadMethod.Existing}
                                inputProps={{
                                  "aria-controls": "forum-thread-select",
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
                                  id="forum-thread-select"
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
                                        ".addDiscordChannelThreadConnectionDialog.formThreadDescripton"
                                    )}
                                  </FormHelperText>
                                </FormControl>
                              </fieldset>
                            </Box>
                          </Stack>
                        </RadioGroup>
                      </FormControl>
                    </fieldset>
                  )}
                />
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
                      <Input {...field} value={field.value || ""} bg="gray.800" />
                    )}
                  />
                  {errors.name && <FormErrorMessage>{errors.name.message}</FormErrorMessage>}
                  <FormHelperText>
                    {t(
                      "features.feed.components" +
                        ".addDiscordChannelThreadConnectionDialog.formNameDescription"
                    )}
                  </FormHelperText>
                </FormControl>
              </Stack>
            </form>
            {submissionError && (
              <InlineErrorAlert
                title={t("common.errors.somethingWentWrong")}
                description={submissionError.message}
              />
            )}
            {isSubmitted && errorCount > 0 && (
              <InlineErrorIncompleteFormAlert fieldCount={errorCount} />
            )}
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
                form="addfeed"
                isLoading={isSubmitting}
                aria-disabled={isSubmitting || !isValid}
              >
                <span>{t("common.buttons.save")}</span>
              </Button>
            ) : (
              <Button colorScheme="blue" onClick={handleNextStep} isDisabled={isSubmitting}>
                <span>Next</span>
              </Button>
            )}
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
