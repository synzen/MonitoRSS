import {
  Alert,
  AlertDescription,
  AlertTitle,
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
} from "@chakra-ui/react";
import { yupResolver } from "@hookform/resolvers/yup";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { InferType, object, string } from "yup";
import React, { useEffect, useRef } from "react";
import { ThemedSelect } from "@/components";
import { useDiscordWebhooks } from "../../../discordWebhooks";
import { useUserFeed } from "../../../feed/hooks";
import { DiscordChannelName } from "../../../discordServers/components/DiscordChannelName";
import { useDiscordUserMe } from "../../../discordUser";
import { DiscordServerSearchSelectv2 } from "../../../discordServers";

const formSchema = object({
  name: string().optional(),
  webhook: object({
    id: string().required("This is a required field"),
    name: string().optional(),
    iconUrl: string().optional(),
  }).when("serverId", ([serverId], schema) => {
    if (serverId) {
      return schema.required();
    }

    return schema.optional();
  }),
  serverId: string().optional(),
});

type FormData = InferType<typeof formSchema>;

interface Props {
  feedId?: string;
  defaultValues: Required<FormData>;
  onUpdate: (data: FormData) => Promise<void>;
  isOpen: boolean;
  onClose: () => void;
  onCloseRef: React.RefObject<HTMLButtonElement>;
}

export const ConvertConnectionToDiscordWebhookDialog: React.FC<Props> = ({
  feedId,
  defaultValues,
  onUpdate,
  isOpen,
  onClose,
  onCloseRef,
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
  const serverId = watch("serverId");
  const { status: feedStatus } = useUserFeed({
    feedId,
  });
  const { data: discordUser, status: discordUserStatus } = useDiscordUserMe();
  const {
    data: discordWebhooks,
    status: discordWebhooksStatus,
    error: discordWebhooksError,
  } = useDiscordWebhooks({
    serverId,
    isWebhooksEnabled: !!discordUser?.supporter,
  });
  const initialRef = useRef<HTMLInputElement>(null);

  const onSubmit = async (formData: FormData) => {
    await onUpdate(formData);
    onClose();
    reset(formData);
  };

  useEffect(() => {
    reset();
  }, [isOpen]);

  const webhooksDisabled = discordUserStatus !== "success" || !discordUser?.supporter;

  const isLoading = feedStatus === "loading" || discordWebhooksStatus === "loading";

  return (
    <Modal
      initialFocusRef={initialRef}
      finalFocusRef={onCloseRef}
      isOpen={isOpen}
      onClose={onClose}
    >
      <ModalOverlay />
      <ModalContent>
        <form onSubmit={handleSubmit(onSubmit)}>
          <ModalHeader>
            {t("features.feed.components.updateDiscordWebhookConnectionDialog.title")}
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {webhooksDisabled && (
              <Text color="orange.500">{t("common.errors.supporterRequiredAccessV2")}</Text>
            )}
            {!webhooksDisabled && (
              <Stack spacing={4}>
                <FormControl isInvalid={!!errors.name}>
                  <FormLabel>
                    {t("features.feed.components.addDiscordWebhookConnectionDialog.formNameLabel")}
                  </FormLabel>
                  <Controller
                    name="name"
                    control={control}
                    render={({ field }) => <Input {...field} ref={initialRef} />}
                  />
                  {errors.name && <FormErrorMessage>{errors.name.message}</FormErrorMessage>}
                  <FormHelperText>
                    {t(
                      "features.feed.components" +
                        ".addDiscordWebhookConnectionDialog.formNameDescription"
                    )}
                  </FormHelperText>
                </FormControl>
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
                        {...field}
                        onChange={(id) => field.onChange(id)}
                        value={field.value || ""}
                      />
                    )}
                  />
                  {errors.serverId && (
                    <FormErrorMessage>{errors.serverId.message}</FormErrorMessage>
                  )}
                  <FormHelperText>
                    {t(
                      "features.feed.components" +
                        ".addDiscordWebhookConnectionDialog.formServerDescription"
                    )}
                  </FormHelperText>
                </FormControl>
                <FormControl isInvalid={!!errors?.webhook?.id}>
                  <FormLabel htmlFor="webhook">
                    {t(
                      "features.feed.components" +
                        ".addDiscordWebhookConnectionDialog.webhookFormLabel"
                    )}
                  </FormLabel>
                  <Controller
                    name="webhook.id"
                    control={control}
                    render={({ field }) => (
                      <ThemedSelect
                        loading={isLoading}
                        isDisabled={isSubmitting || isLoading}
                        options={
                          discordWebhooks?.map((webhook) => ({
                            label: (
                              <span>
                                {webhook.name} (
                                <DiscordChannelName
                                  serverId={serverId}
                                  channelId={webhook.channelId}
                                />
                                )
                              </span>
                            ),
                            value: webhook.id,
                            icon: webhook.avatarUrl,
                            data: webhook,
                          })) || []
                        }
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        value={field.value}
                      />
                    )}
                  />
                  <Stack>
                    {errors.webhook && (
                      <FormErrorMessage>{errors.webhook.message}</FormErrorMessage>
                    )}
                    <FormHelperText>
                      {t(
                        "features.feed.components.addDiscordWebhookConnectionDialog" +
                          ".webhooksInputHelperText"
                      )}
                    </FormHelperText>
                    {discordWebhooksError && (
                      <Alert status="error">
                        <Box>
                          <AlertTitle>
                            {t(
                              "features.feed.components." +
                                "addDiscordWebhookConnectionDialog.failedToGetWebhooks"
                            )}
                          </AlertTitle>
                          <AlertDescription>{discordWebhooksError.message}</AlertDescription>
                        </Box>
                      </Alert>
                    )}
                  </Stack>
                </FormControl>
                <FormControl>
                  <FormLabel>
                    {t(
                      "features.feed.components" +
                        ".addDiscordWebhookConnectionDialog.webhookNameLabel"
                    )}
                  </FormLabel>
                  <Controller
                    name="webhook.name"
                    control={control}
                    render={({ field }) => (
                      <Input placeholder="Optional" {...field} isDisabled={isSubmitting} />
                    )}
                  />
                  <FormHelperText>
                    {t(
                      "features.feed.components.addDiscordWebhookConnectionDialog" +
                        ".webhookNameDescription"
                    )}
                  </FormHelperText>
                </FormControl>
                <FormControl>
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
                      <Input placeholder="Optional" {...field} isDisabled={isSubmitting} />
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
                {t("common.buttons.cancel")}
              </Button>
              <Button
                type="submit"
                colorScheme="blue"
                isDisabled={isSubmitting || !isDirty}
                isLoading={isSubmitting}
              >
                {t("common.buttons.save")}
              </Button>
            </HStack>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
};
