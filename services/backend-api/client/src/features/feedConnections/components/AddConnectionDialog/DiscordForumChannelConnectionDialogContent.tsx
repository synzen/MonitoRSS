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
  Stack,
  Text,
  Stepper,
  Step,
  StepIndicator,
  StepStatus,
  StepNumber,
  StepTitle,
  StepSeparator,
  useSteps,
} from "@chakra-ui/react";
import { CheckIcon } from "@chakra-ui/icons";
import { yupResolver } from "@hookform/resolvers/yup";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { InferType, object, string } from "yup";
import { useEffect, useRef } from "react";
import {
  DiscordActiveThreadDropdown,
  DiscordChannelDropdown,
  DiscordServerSearchSelectv2,
  GetDiscordChannelType,
} from "@/features/discordServers";
import RouteParams from "../../../../types/RouteParams";
import {
  useCreateDiscordChannelConnection,
  useUpdateDiscordChannelConnection,
  useConnectionTemplateSelection,
  convertTemplateToUpdateDetails,
} from "../../hooks";
import { InlineErrorAlert, InlineErrorIncompleteFormAlert } from "../../../../components";
import { FeedDiscordChannelConnection } from "../../../../types";
import { usePageAlertContext } from "../../../../contexts/PageAlertContext";
import { TemplateGalleryModal } from "../../../templates/components/TemplateGalleryModal";
import {
  TEMPLATES,
  DEFAULT_TEMPLATE,
  getTemplateById,
} from "../../../templates/constants/templates";

const formSchema = object({
  name: string().required("Name is required").max(250, "Name must be fewer than 250 characters"),
  serverId: string().required("Discord server is required"),
  channelId: string().when("serverId", ([serverId], schema) => {
    if (serverId) {
      return schema.required("Discord forum channel is required");
    }

    return schema.optional();
  }),
  threadId: string(),
});

interface Props {
  onClose: () => void;
  isOpen: boolean;
  connection?: FeedDiscordChannelConnection;
}

type FormData = InferType<typeof formSchema>;

const connectionSteps = [
  { title: "Channel" },
  { title: "Template" },
];

export const DiscordForumChannelConnectionDialogContent: React.FC<Props> = ({
  connection,
  onClose,
  isOpen,
}) => {
  const isEditing = !!connection;

  // Template selection state
  const {
    currentStep,
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
    getTemplateUpdateDetails,
  } = useConnectionTemplateSelection({ isOpen, isEditing });

  // Stepper for visual progress (only for new connections)
  const activeStepIndex = isTemplateStep ? 1 : 0;
  const { activeStep } = useSteps({
    index: activeStepIndex,
    count: connectionSteps.length,
  });

  const defaultValues: Partial<FormData> = {
    name: connection?.name,
    serverId: connection?.details.channel?.guildId,
    threadId: connection?.details.channel?.parentChannelId
      ? connection?.details.channel?.id
      : undefined,
    channelId: connection?.details.channel?.parentChannelId || connection?.details.channel?.id,
  };
  const { feedId } = useParams<RouteParams>();
  const { t } = useTranslation();
  const {
    handleSubmit,
    control,
    reset,
    trigger,
    formState: { errors, isSubmitting, isValid, isSubmitted },
    watch,
    setValue,
  } = useForm<FormData>({
    resolver: yupResolver(formSchema),
    mode: "all",
    defaultValues,
  });
  const [serverId, channelId] = watch(["serverId", "channelId"]);
  const { mutateAsync, error } = useCreateDiscordChannelConnection();
  const { mutateAsync: updateMutateAsync, error: updateError } =
    useUpdateDiscordChannelConnection();
  const { createSuccessAlert } = usePageAlertContext();
  const initialFocusRef = useRef<any>(null);

  useEffect(() => {
    reset(defaultValues);
  }, [connection?.id]);

  const handleNextStep = async () => {
    const isFormValid = await trigger(["serverId", "channelId", "name"]);

    if (isFormValid) {
      templateHandleNextStep();
    }
  };

  const executeUpdate = async ({ channelId: inputChannelId, name, threadId }: FormData) => {
    if (!feedId) {
      throw new Error("Feed ID missing while updating discord forum channel connection");
    }

    if (!connection) {
      throw new Error("Connection missing while updating discord forum channel connection");
    }

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

    createSuccessAlert({
      title: "Successfully updated connection.",
    });
    onClose();
  };

  const executeCreate = async ({ channelId: inputChannelId, name, threadId }: FormData) => {
    if (!feedId) {
      throw new Error("Feed ID missing while creating discord forum channel connection");
    }

    // Create the connection first
    const createResult = await mutateAsync({
      feedId,
      details: {
        name,
        channelId: threadId || inputChannelId,
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
  };

  const onSubmit = async (form: FormData) => {
    if (!feedId) {
      throw new Error("Feed ID missing while creating discord channel connection");
    }

    try {
      if (connection) {
        await executeUpdate(form);
      } else {
        await executeCreate(form);
      }
    } catch (err) {}
  };

  useEffect(() => {
    reset();
  }, [isOpen]);

  const formErrorLength = Object.keys(errors).length;

  const useError = error || updateError;

  // Create step indicator for template selection modal
  const templateStepIndicator = (
    <Stepper index={1} size="sm" colorScheme="blue">
      {connectionSteps.map((step, index) => (
        <Step key={index}>
          <StepIndicator>
            <StepStatus
              complete={<CheckIcon boxSize={3} />}
              incomplete={<StepNumber />}
              active={<StepNumber />}
            />
          </StepIndicator>
          <Box flexShrink="0">
            <StepTitle>{step.title}</StepTitle>
          </Box>
          <StepSeparator />
        </Step>
      ))}
    </Stepper>
  );

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
        testId="forum-template-selection-modal"
        stepIndicator={templateStepIndicator}
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
          {connection ? "Edit Discord Forum Connection" : "Add Discord Forum Connection"}
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Stack spacing={4}>
            {!isEditing && (
              <Stepper index={activeStep} size="sm" colorScheme="blue">
                {connectionSteps.map((step, index) => (
                  <Step key={index}>
                    <StepIndicator>
                      <StepStatus
                        complete={<CheckIcon boxSize={3} />}
                        incomplete={<StepNumber />}
                        active={<StepNumber />}
                      />
                    </StepIndicator>
                    <Box flexShrink="0">
                      <StepTitle>{step.title}</StepTitle>
                    </Box>
                    <StepSeparator />
                  </Step>
                ))}
              </Stepper>
            )}
            <Text>Send articles as messages authored by the bot to a Discord forum</Text>
            <form id="addfeed" onSubmit={handleSubmit(onSubmit)}>
              <Stack spacing={4}>
                <FormControl isInvalid={!!errors.serverId} isRequired>
                  <FormLabel htmlFor="server-select">
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
                        ariaLabelledBy="server-select"
                        inputId="server-select"
                        alertOnArticleEligibility
                        isInvalid={!!errors.serverId}
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
                    Discord Forum Channel
                  </FormLabel>
                  <Controller
                    name="channelId"
                    control={control}
                    render={({ field }) => (
                      <DiscordChannelDropdown
                        value={field.value}
                        isInvalid={!!errors.channelId}
                        onChange={(value, name) => {
                          field.onChange(value);
                          setValue("name", name, {
                            shouldDirty: true,
                            shouldTouch: true,
                            shouldValidate: true,
                          });
                        }}
                        types={[GetDiscordChannelType.Forum]}
                        onBlur={field.onBlur}
                        isDisabled={isSubmitting}
                        serverId={serverId}
                        inputId="channel-select"
                        ariaLabelledBy="channel-select-label"
                      />
                    )}
                  />
                  <FormErrorMessage>{errors.channelId?.message}</FormErrorMessage>
                </FormControl>
                <FormControl>
                  <FormLabel id="thread-label">Existing Forum Thread</FormLabel>
                  <Controller
                    name="threadId"
                    control={control}
                    render={({ field }) => (
                      <DiscordActiveThreadDropdown
                        ariaLabelledBy="thread-label"
                        isInvalid={false}
                        isClearable
                        inputId="thread-select"
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
                    Optionally specify an existing thread that new articles should be sent to rather
                    than creating new threads.
                  </FormHelperText>
                </FormControl>
                <FormControl isInvalid={!!errors.name} isRequired>
                  <FormLabel>
                    {t("features.feed.components.addDiscordChannelConnectionDialog.formNameLabel")}
                  </FormLabel>
                  <Controller
                    name="name"
                    control={control}
                    render={({ field }) => <Input {...field} bg="gray.800" />}
                  />
                  {errors.name && <FormErrorMessage>{errors.name.message}</FormErrorMessage>}
                  <FormHelperText>
                    {t(
                      "features.feed.components" +
                        ".addDiscordChannelConnectionDialog.formNameDescription"
                    )}
                  </FormHelperText>
                </FormControl>
              </Stack>
            </form>
            {useError && (
              <InlineErrorAlert
                title={t("common.errors.somethingWentWrong")}
                description={useError.message}
              />
            )}
            {isSubmitted && formErrorLength > 0 && (
              <InlineErrorIncompleteFormAlert fieldCount={formErrorLength} />
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
                <span>
                  {t("features.feed.components.addDiscordChannelConnectionDialog.saveButton")}
                </span>
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
