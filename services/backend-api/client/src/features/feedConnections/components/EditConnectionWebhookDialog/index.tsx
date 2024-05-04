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
import { InferType, object, string } from "yup";
import React, { useEffect, useRef } from "react";
import { useDiscordUserMe } from "../../../discordUser";
import {
  DiscordActiveThreadDropdown,
  DiscordChannelDropdown,
  DiscordServerSearchSelectv2,
  GetDiscordChannelType,
} from "../../../discordServers";

const formSchema = object({
  name: string().optional(),
  applicationWebhook: object({
    name: string().required(),
    channelId: string().required(),
    iconUrl: string().optional(),
    threadId: string().optional(),
  }),
  serverId: string().optional(),
});

type FormData = InferType<typeof formSchema>;

interface Props {
  defaultValues?: Required<FormData>;
  onUpdate: (data: FormData) => Promise<void>;
  isOpen: boolean;
  onClose: () => void;
  onCloseRef: React.RefObject<HTMLButtonElement>;
  excludeName?: boolean;
  title?: string;
}

export const EditConnectionWebhookDialog: React.FC<Props> = ({
  defaultValues,
  onUpdate,
  isOpen,
  onClose,
  onCloseRef,
  excludeName,
  title,
}) => {
  const { t } = useTranslation();
  const {
    handleSubmit,
    control,
    reset,
    formState: { isDirty, isSubmitting, errors },
    watch,
  } = useForm<FormData>({
    resolver: yupResolver(formSchema),
    defaultValues,
  });
  const [serverId, channelId] = watch(["serverId", "applicationWebhook.channelId"]);
  const { data: discordUser, status: discordUserStatus } = useDiscordUserMe();
  const initialRef = useRef<HTMLInputElement>(null);

  const onSubmit = async (formData: FormData) => {
    const { name, serverId: inputServerId, applicationWebhook } = formData;

    await onUpdate({
      name,
      serverId: inputServerId,
      applicationWebhook: {
        name: applicationWebhook.name,
        channelId: applicationWebhook.channelId,
        iconUrl: applicationWebhook.iconUrl,
        threadId: applicationWebhook.threadId,
      },
    });
    onClose();
    reset(formData);
  };

  useEffect(() => {
    reset();
  }, [isOpen]);

  const webhooksDisabled = discordUserStatus !== "success" || !discordUser?.supporter;

  return (
    <Modal
      initialFocusRef={initialRef}
      finalFocusRef={onCloseRef}
      isOpen={isOpen}
      onClose={onClose}
    >
      <ModalOverlay />
      <ModalContent>
        <form
          onSubmit={(e) => {
            e.stopPropagation();
            handleSubmit(onSubmit)(e);
          }}
        >
          <ModalHeader>
            {title || t("features.feed.components.updateDiscordWebhookConnectionDialog.title")}
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {webhooksDisabled && (
              <Text color="orange.500">{t("common.errors.supporterRequiredAccessV2")}</Text>
            )}
            {!webhooksDisabled && (
              <Stack spacing={4}>
                {!excludeName && (
                  <FormControl isInvalid={!!errors.name} isRequired>
                    <FormLabel>
                      {t(
                        "features.feed.components.addDiscordWebhookConnectionDialog.formNameLabel"
                      )}
                    </FormLabel>
                    <Controller
                      name="name"
                      control={control}
                      render={({ field }) => (
                        <Input
                          {...field}
                          ref={initialRef}
                          value={field.value || ""}
                          bg="gray.800"
                          isDisabled={isSubmitting}
                        />
                      )}
                    />
                    {errors.name && <FormErrorMessage>{errors.name.message}</FormErrorMessage>}
                    <FormHelperText>
                      {t(
                        "features.feed.components" +
                          ".addDiscordWebhookConnectionDialog.formNameDescription"
                      )}
                    </FormHelperText>
                  </FormControl>
                )}
                <FormControl isInvalid={!!errors.serverId}>
                  <FormLabel>
                    {t(
                      "features.feed.components" +
                        ".addDiscordWebhookConnectionDialog.formServerLabel"
                    )}
                  </FormLabel>
                  <Controller
                    name="serverId"
                    control={control}
                    render={({ field }) => (
                      <DiscordServerSearchSelectv2
                        onChange={(id) => field.onChange(id)}
                        value={field.value || ""}
                        isDisabled={isSubmitting}
                      />
                    )}
                  />
                  {errors.serverId && (
                    <FormErrorMessage>{errors.serverId.message}</FormErrorMessage>
                  )}
                  <FormHelperText>
                    Only servers where you have server-wide Manage Channels permission will appear.
                    If you don&apos;t have this permission, you may ask someone who does to add the
                    feed and share it with you.
                  </FormHelperText>
                </FormControl>
                <FormControl isInvalid={!!errors.applicationWebhook?.channelId} isRequired>
                  <FormLabel>Channel</FormLabel>
                  <Controller
                    name="applicationWebhook.channelId"
                    control={control}
                    render={({ field }) => (
                      <DiscordChannelDropdown
                        value={field.value || ""}
                        onChange={(value) => {
                          field.onChange(value);
                        }}
                        include={[GetDiscordChannelType.Forum]}
                        onBlur={field.onBlur}
                        isDisabled={isSubmitting}
                        serverId={serverId}
                      />
                    )}
                  />
                  {errors.applicationWebhook?.channelId && (
                    <FormErrorMessage>
                      {errors.applicationWebhook?.channelId?.message}
                    </FormErrorMessage>
                  )}
                </FormControl>
                <FormControl isInvalid={!!errors.applicationWebhook?.threadId}>
                  <FormLabel>Forum Thread</FormLabel>
                  <Controller
                    name="applicationWebhook.threadId"
                    control={control}
                    render={({ field }) => (
                      <DiscordActiveThreadDropdown
                        value={field.value || ""}
                        onChange={(value) => {
                          field.onChange(value);
                        }}
                        onBlur={field.onBlur}
                        isDisabled={isSubmitting}
                        serverId={serverId}
                        isClearable
                        parentChannelId={channelId}
                      />
                    )}
                  />
                  {errors.applicationWebhook?.threadId && (
                    <FormErrorMessage>
                      {errors.applicationWebhook?.threadId?.message}
                    </FormErrorMessage>
                  )}
                  {!errors.applicationWebhook?.threadId && (
                    <FormHelperText>
                      If specified, all messages will go into a specific thread. Only unlocked
                      (unarchived) threads are listed.
                    </FormHelperText>
                  )}
                </FormControl>
                <FormControl isRequired isInvalid={!!errors.applicationWebhook?.name}>
                  <FormLabel>
                    {t(
                      "features.feed.components" +
                        ".addDiscordWebhookConnectionDialog.webhookNameLabel"
                    )}
                  </FormLabel>
                  <Controller
                    name="applicationWebhook.name"
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
                  <FormHelperText>
                    {t(
                      "features.feed.components.addDiscordWebhookConnectionDialog" +
                        ".webhookNameDescription"
                    )}
                  </FormHelperText>
                </FormControl>
                <FormControl isInvalid={!!errors.applicationWebhook?.iconUrl}>
                  <FormLabel>
                    {t(
                      "features.feed.components.addDiscordWebhookConnectionDialog" +
                        ".webhookIconUrlLabel"
                    )}
                  </FormLabel>
                  <Controller
                    name="applicationWebhook.iconUrl"
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
                  <FormHelperText>
                    {t(
                      "features.feed.components.addDiscordWebhookConnectionDialog" +
                        ".webhookIconUrlDescription"
                    )}
                  </FormHelperText>
                </FormControl>
              </Stack>
            )}
          </ModalBody>
          <ModalFooter>
            <HStack>
              <Button onClick={onClose} variant="ghost" isDisabled={isSubmitting}>
                <span>{t("common.buttons.cancel")}</span>
              </Button>
              <Button
                type="submit"
                colorScheme="blue"
                isDisabled={isSubmitting || !isDirty}
                isLoading={isSubmitting}
              >
                <span>{t("common.buttons.save")}</span>
              </Button>
            </HStack>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
};
