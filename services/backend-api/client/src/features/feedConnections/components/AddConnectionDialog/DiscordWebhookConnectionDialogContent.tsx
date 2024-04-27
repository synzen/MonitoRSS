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
import { useEffect, useRef } from "react";
import RouteParams from "../../../../types/RouteParams";
import { ThemedSelect } from "@/components";
import { useDiscordWebhooks } from "../../../discordWebhooks";
import { useUserFeed } from "../../../feed/hooks";
import { DiscordChannelName } from "../../../discordServers/components/DiscordChannelName";
import { notifyError } from "../../../../utils/notifyError";
import { useCreateDiscordChannelConnection } from "../../hooks";
import { DiscordActiveThreadDropdown, DiscordServerSearchSelectv2 } from "../../../discordServers";
import { notifySuccess } from "../../../../utils/notifySuccess";
import { SubscriberBlockText } from "@/components/SubscriberBlockText";
import { BlockableFeature, SupporterTier } from "../../../../constants";

const formSchema = object({
  name: string().required(),
  serverId: string().required(),
  webhook: object({
    id: string().required("This is a required field"),
    name: string().optional(),
    iconUrl: string().optional(),
    threadId: string().optional(),
  }),
});

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

type FormData = InferType<typeof formSchema>;

export const DiscordWebhookConnectionDialogContent: React.FC<Props> = ({ isOpen, onClose }) => {
  const { feedId } = useParams<RouteParams>();
  const { t } = useTranslation();
  const {
    handleSubmit,
    control,
    reset,
    formState: { isSubmitting, errors, isValid },
    watch,
    setValue,
  } = useForm<FormData>({
    resolver: yupResolver(formSchema),
    mode: "all",
  });
  const [serverId, webhookId] = watch(["serverId", "webhook.id"]);
  const { status: feedStatus } = useUserFeed({
    feedId,
  });
  const {
    data: discordWebhooks,
    fetchStatus: discordWebhooksFetchStatus,
    error: discordWebhooksError,
  } = useDiscordWebhooks({
    serverId,
    isWebhooksEnabled: isOpen,
  });
  const initialFocusRef = useRef<any>(null);

  const { mutateAsync } = useCreateDiscordChannelConnection();

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

  const isLoading = feedStatus === "loading" || discordWebhooksFetchStatus === "fetching";

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      closeOnOverlayClick={!isSubmitting}
      initialFocusRef={initialFocusRef}
    >
      <ModalOverlay />
      <form onSubmit={handleSubmit(onSubmit)}>
        <ModalContent>
          <ModalHeader>
            {t("features.feed.components.addDiscordWebhookConnectionDialog.title")}
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Stack spacing={4}>
              <Text>
                Send articles authored by a webhook with a custom name and avatar as a message to a
                Discord channel.
              </Text>
              <SubscriberBlockText
                feature={BlockableFeature.DiscordWebhooks}
                tier={SupporterTier.T1}
                onClick={onClose}
              />
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
                        onChange={(id) => field.onChange(id)}
                        value={field.value}
                        inputRef={initialFocusRef}
                      />
                    )}
                  />
                </FormControl>
                <FormControl isRequired>
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
                            data: webhook,
                          })) || []
                        }
                        onChange={(val, data) => {
                          field.onChange(val);
                          setValue("name", data.name, {
                            shouldDirty: true,
                            shouldTouch: true,
                            shouldValidate: true,
                          });
                        }}
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
                  <FormLabel>Forum Thread</FormLabel>
                  <Controller
                    name="webhook.threadId"
                    control={control}
                    render={({ field }) => {
                      const matchingWebhookChannelId = discordWebhooks?.find(
                        (w) => w.id === webhookId
                      )?.channelId;

                      return (
                        <DiscordActiveThreadDropdown
                          value={field.value || ""}
                          onChange={(value) => {
                            field.onChange(value);
                          }}
                          onBlur={field.onBlur}
                          isDisabled={isSubmitting || !matchingWebhookChannelId}
                          serverId={serverId}
                          isClearable
                          parentChannelId={matchingWebhookChannelId}
                        />
                      );
                    }}
                  />
                  {errors.webhook?.id && (
                    <FormErrorMessage>{errors.webhook.id.message}</FormErrorMessage>
                  )}
                  <Stack>
                    <FormHelperText>
                      If specified, all messages will go into a specific thread. Only unlocked
                      (unarchived) threads are listed.
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
                  <FormHelperText>
                    {t(
                      "features.feed.components.addDiscordWebhookConnectionDialog" +
                        ".webhookIconUrlDescription"
                    )}
                  </FormHelperText>
                </FormControl>
                <FormControl isInvalid={!!errors.name} isRequired>
                  <FormLabel>
                    {t("features.feed.components.addDiscordWebhookConnectionDialog.formNameLabel")}
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
                        ".addDiscordWebhookConnectionDialog.formNameDescription"
                    )}
                  </FormHelperText>
                </FormControl>
              </Stack>
            </Stack>
          </ModalBody>
          <ModalFooter>
            <HStack>
              <Button onClick={onClose} variant="ghost" isDisabled={isSubmitting}>
                {t("common.buttons.cancel")}
              </Button>
              <Button
                type="submit"
                colorScheme="blue"
                isDisabled={isSubmitting || !isValid}
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
