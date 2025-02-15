import {
  Alert,
  AlertDescription,
  AlertTitle,
  Box,
  Button,
  Flex,
  FormControl,
  FormHelperText,
  FormLabel,
  HStack,
  Input,
  Stack,
  Text,
} from "@chakra-ui/react";
import { useForm, Controller } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { InferType, object, string } from "yup";
import { yupResolver } from "@hookform/resolvers/yup";
import { useEffect } from "react";
import { ThemedSelect } from "@/components";
import { useFeed } from "../../hooks";
import { useDiscordServer } from "@/features/discordServers";
import { useDiscordWebhooks } from "@/features/discordWebhooks";
import { notifySuccess } from "@/utils/notifySuccess";
import { useUpdateFeed } from "../../hooks/useUpdateFeed";
import { Feed } from "@/types";
import { notifyError } from "@/utils/notifyError";
import { UpdateFeedInput } from "../../api";
import { DiscordChannelName } from "@/features/discordServers/components/DiscordChannelName";

const formSchema = object({
  webhookId: string().optional(),
  name: string().optional(),
  iconUrl: string().optional(),
});

type FormData = InferType<typeof formSchema>;

interface Props {
  feedId: string;
  serverId: string;
  onUpdated: (feed: Feed) => void;
}

export const WebhookForm: React.FC<Props> = ({ feedId, serverId, onUpdated }) => {
  const { t } = useTranslation();
  const { feed, status: feedStatus } = useFeed({
    feedId,
  });
  const { data: discordServerData, status: discordServerStatus } = useDiscordServer({ serverId });
  const {
    data: discordWebhooks,
    status: discordWebhooksStatus,
    error: discordWebhooksError,
  } = useDiscordWebhooks({
    serverId,
    isWebhooksEnabled: discordServerData?.benefits.webhooks,
  });
  const { mutateAsync } = useUpdateFeed();
  const defaultFormValues: FormData = {
    webhookId: feed?.webhook?.id,
    name: feed?.webhook?.name,
    iconUrl: feed?.webhook?.iconUrl,
  };
  const {
    handleSubmit,
    control,
    reset,
    formState: { isDirty, isSubmitting },
  } = useForm<FormData>({
    resolver: yupResolver(formSchema),
    defaultValues: defaultFormValues,
  });

  const resetForm = () => {
    reset(defaultFormValues);
  };

  const onSubmit = async (formData: FormData) => {
    try {
      const input: UpdateFeedInput = {
        feedId,
        details: {
          webhook: {
            id:
              formData.webhookId !== undefined && formData.webhookId !== feed?.webhook?.id
                ? formData.webhookId
                : undefined,
            name: formData.name ?? undefined,
            iconUrl: formData.iconUrl ?? undefined,
          },
        },
      };

      const updatedFeed = await mutateAsync(input);
      onUpdated(updatedFeed.result);
      await notifySuccess(t("features.feed.components.sidebar.updateSuccess"));
      reset({
        webhookId: updatedFeed.result.webhook?.id || "",
        name: updatedFeed.result.webhook?.name || "",
        iconUrl: updatedFeed.result.webhook?.iconUrl || "",
      });
    } catch (err) {
      notifyError(t("common.errors.somethingWentWrong"), err as Error);
    }
  };

  useEffect(() => {
    resetForm();
  }, [feed]);

  const webhooksDisabled =
    discordServerStatus !== "success" || !discordServerData?.benefits.webhooks;

  const isLoading = feedStatus === "loading" || discordWebhooksStatus === "loading";

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      {webhooksDisabled && (
        <Text color="orange.500">{t("common.errors.supporterRequiredAccess")}</Text>
      )}
      {!webhooksDisabled && (
        <Stack spacing={4}>
          <FormControl>
            <FormLabel htmlFor="webhook">
              {t("features.feed.components.sidebar.webhookFormLabel")}
            </FormLabel>
            <Controller
              name="webhookId"
              control={control}
              render={({ field }) => (
                <ThemedSelect
                  isInvalid={false}
                  loading={isLoading}
                  isDisabled={isSubmitting || isLoading}
                  isClearable
                  options={
                    discordWebhooks?.map((webhook) => ({
                      label: (
                        <span>
                          {webhook.name} (
                          <DiscordChannelName serverId={serverId} channelId={webhook.channelId} />)
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
              <FormHelperText>
                {t("features.feed.components.sidebar.webhooksInputHelperText")}
              </FormHelperText>
              {discordWebhooksError && (
                <Alert status="error">
                  <Box>
                    <AlertTitle>
                      {t("features.feed.components.sidebar.failedToGetWebhooks")}
                    </AlertTitle>
                    <AlertDescription>{discordWebhooksError.message}</AlertDescription>
                  </Box>
                </Alert>
              )}
            </Stack>
          </FormControl>
          <FormControl>
            <FormLabel htmlFor="title">
              {t("features.feed.components.sidebar.webhookNameLabel")}
            </FormLabel>
            <Controller
              name="name"
              control={control}
              render={({ field }) => (
                <Input placeholder="Optional" {...field} isDisabled={isSubmitting} />
              )}
            />
            <FormHelperText>
              {t("features.feed.components.sidebar.webhookNameDescription")}
            </FormHelperText>
          </FormControl>
          <FormControl>
            <FormLabel htmlFor="iconUrl">
              {t("features.feed.components.sidebar.webhookIconUrlLabel")}
            </FormLabel>
            <Controller
              name="iconUrl"
              control={control}
              render={({ field }) => (
                <Input placeholder="Optional" {...field} isDisabled={isSubmitting} />
              )}
            />
            <FormHelperText>
              {t("features.feed.components.sidebar.webhookIconUrlDescription")}
            </FormHelperText>
          </FormControl>
          <Flex justifyContent="flex-end">
            <HStack>
              <Button onClick={() => reset()} variant="ghost" isDisabled={!isDirty || isSubmitting}>
                <span>{t("features.feed.components.sidebar.resetButton")}</span>
              </Button>
              <Button
                type="submit"
                colorScheme="blue"
                isDisabled={isSubmitting || !isDirty}
                isLoading={isSubmitting}
              >
                <span>{t("features.feed.components.sidebar.saveButton")}</span>
              </Button>
            </HStack>
          </Flex>
        </Stack>
      )}
    </form>
  );
};
