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
import { notifyError } from "../../../../utils/notifyError";
import { useCreateDiscordChannelConnection } from "../../hooks";
import {
  DiscordActiveThreadDropdown,
  DiscordChannelDropdown,
  DiscordServerSearchSelectv2,
  GetDiscordChannelType,
} from "../../../discordServers";
import { notifySuccess } from "../../../../utils/notifySuccess";

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
  const {
    handleSubmit,
    control,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting, isValid },
  } = useForm<FormData>({
    resolver: yupResolver(formSchema),
    mode: "all",
  });
  const [serverId, channelId, threadId] = watch(["serverId", "channelId", "threadId"]);
  const { mutateAsync } = useCreateDiscordChannelConnection();
  const initialFocusRef = useRef<any>(null);

  const onSubmit = async ({ threadId: inputThreadId, name, webhook }: FormData) => {
    if (!feedId) {
      throw new Error("Feed ID missing while creating discord channel connection");
    }

    try {
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
        },
      });
      notifySuccess(
        "Succesfully added connection. New articles will be automatically delivered when found."
      );
      onClose();
    } catch (err) {
      notifyError(t("common.errors.somethingWentWrong"), err as Error);
    }
  };

  useEffect(() => {
    reset();
  }, [isOpen]);

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
            <form id="addfeed" onSubmit={handleSubmit(onSubmit)}>
              <Stack spacing={4}>
                <FormControl isInvalid={!!errors.serverId} isRequired>
                  <FormLabel>
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
                      />
                    )}
                  />
                </FormControl>
                <FormControl isInvalid={!!errors.channelId} isRequired>
                  <FormLabel>Channel</FormLabel>
                  <Controller
                    name="channelId"
                    control={control}
                    render={({ field }) => (
                      <DiscordChannelDropdown
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
                        include={[GetDiscordChannelType.Forum]}
                        onBlur={field.onBlur}
                        isDisabled={isSubmitting}
                        serverId={serverId}
                      />
                    )}
                  />
                  {errors.channelId && (
                    <FormErrorMessage>{errors.channelId?.message}</FormErrorMessage>
                  )}
                </FormControl>
                <FormControl isInvalid={!!errors.threadId?.message}>
                  <FormLabel>Forum Thread</FormLabel>
                  <Controller
                    name="threadId"
                    control={control}
                    render={({ field }) => (
                      <DiscordActiveThreadDropdown
                        value={field.value || ""}
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
                      If enabled, all messages will go into a specific thread. Only unlocked
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
                        placeholder="Optional"
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
                    <FormHelperText>The user name the webhook will use</FormHelperText>
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
                      <Input {...field} value={field.value || ""} bg="gray.800" />
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
          </Stack>
        </ModalBody>
        <ModalFooter>
          <HStack>
            <Button variant="ghost" mr={3} onClick={onClose} isDisabled={isSubmitting}>
              {t("common.buttons.cancel")}
            </Button>
            <Button
              colorScheme="blue"
              type="submit"
              form="addfeed"
              isLoading={isSubmitting}
              isDisabled={isSubmitting || !isValid}
            >
              {t("common.buttons.save")}
            </Button>
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
