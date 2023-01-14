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
import { useParams } from "react-router-dom";
import { InferType, object, string } from "yup";
import { useEffect } from "react";
import RouteParams from "../../../../types/RouteParams";
import { ThemedSelect } from "@/components";
import { useDiscordWebhooks } from "../../../discordWebhooks";
import { useUserFeed } from "../../../feed/hooks";
import { DiscordChannelName } from "../../../discordServers/components/DiscordChannelName";
import { notifyError } from "../../../../utils/notifyError";
import { useCreateDiscordWebhookConnection } from "../../hooks";
import { useDiscordUserMe } from "../../../discordUser";
import { DiscordServerSearchSelectv2 } from "../../../discordServers";

const formSchema = object({
  name: string().required(),
  serverId: string().required(),
  webhook: object({
    id: string().required("This is a required field"),
    name: string().optional(),
    iconUrl: string().optional(),
  }),
});

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

type FormData = InferType<typeof formSchema>;

export const DiscordWebhookConnectionContent: React.FC<Props> = ({ isOpen, onClose }) => {
  const { feedId } = useParams<RouteParams>();
  const { t } = useTranslation();
  const {
    handleSubmit,
    control,
    reset,
    formState: { isSubmitting, errors, isValid },
    watch,
  } = useForm<FormData>({
    resolver: yupResolver(formSchema),
    mode: "all",
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

  const { mutateAsync } = useCreateDiscordWebhookConnection();

  const onSubmit = async ({ webhook, name }: FormData) => {
    if (!feedId) {
      throw new Error("Feed ID missing while creating discord channel connection");
    }

    try {
      await mutateAsync({
        feedId,
        details: {
          webhook,
          name,
        },
      });
      onClose();
    } catch (err) {
      notifyError(
        t("features.feed.components.addDiscordChannelConnectionDialog.failedToAdd"),
        err as Error
      );
    }
  };

  useEffect(() => {
    reset();
  }, [isOpen]);

  const webhooksDisabled = discordUserStatus !== "success" || !discordUser?.supporter;

  const isLoading = feedStatus === "loading" || discordWebhooksStatus === "loading";

  return (
    <Modal isOpen={isOpen} onClose={onClose} closeOnOverlayClick={!isSubmitting}>
      <ModalOverlay />
      <form onSubmit={handleSubmit(onSubmit)}>
        <ModalContent>
          <ModalHeader>
            {t("features.feed.components.addDiscordWebhookConnectionDialog.title")}
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
                    render={({ field }) => <Input {...field} />}
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
                      "features.feed.components.addDiscordWebhookConnectionDialog.formServerLabel"
                    )}
                  </FormLabel>
                  <Controller
                    name="serverId"
                    control={control}
                    render={({ field }) => (
                      <DiscordServerSearchSelectv2
                        {...field}
                        onChange={(id) => field.onChange(id)}
                        value={field.value}
                      />
                    )}
                  />
                </FormControl>
                <FormControl>
                  <FormLabel>
                    {t(
                      "features.feed.components.addDiscordWebhookConnectionDialog.webhookFormLabel"
                    )}
                  </FormLabel>
                  <Controller
                    name="webhook.id"
                    control={control}
                    render={({ field }) => (
                      <ThemedSelect
                        {...field}
                        loading={isLoading}
                        isDisabled={isSubmitting || isLoading || !serverId}
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
                          })) || []
                        }
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        value={field.value}
                      />
                    )}
                  />
                  {errors.webhook?.id && (
                    <FormErrorMessage>{errors.webhook.id.message}</FormErrorMessage>
                  )}
                  <Stack>
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
                      "features.feed.components.addDiscordWebhookConnectionDialog.webhookNameLabel"
                    )}
                  </FormLabel>
                  <Controller
                    name="webhook.name"
                    control={control}
                    render={({ field }) => (
                      <Input {...field} placeholder="Optional" isDisabled={isSubmitting} />
                    )}
                  />
                  {errors.webhook?.name && (
                    <FormErrorMessage>{errors.webhook.name.message}</FormErrorMessage>
                  )}
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
                  {errors.webhook?.iconUrl && (
                    <FormErrorMessage>{errors.webhook.iconUrl.message}</FormErrorMessage>
                  )}
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
              <Button onClick={onClose} variant="ghost" disabled={isSubmitting}>
                {t("common.buttons.cancel")}
              </Button>
              <Button
                type="submit"
                colorScheme="blue"
                disabled={isSubmitting || !isValid}
                isLoading={isSubmitting}
              >
                {t("features.feed.components.addDiscordWebhookConnectionDialog.saveButton")}
              </Button>
            </HStack>
          </ModalFooter>
        </ModalContent>
      </form>
    </Modal>
  );
};
