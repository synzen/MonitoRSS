import {
  Alert,
  AlertDescription,
  AlertTitle,
  Box,
  Button,
  Flex,
  FormControl, FormHelperText, FormLabel, HStack, Input, Stack, Text,
} from '@chakra-ui/react';
import { useForm, Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { InferType, object, string } from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
import { useEffect } from 'react';
import { ThemedSelect } from '@/components';
import { useFeed } from '../../hooks';
import { DiscordChannelDropdown, useDiscordServer } from '@/features/discordServers';
import { useDiscordWebhooks } from '@/features/discordWebhooks';

import { notifySuccess } from '@/utils/notifySuccess';
import { useUpdateFeed } from '../../hooks/useUpdateFeed';
import { Feed } from '../../types';
import { notifyError } from '@/utils/notifyError';
import { UpdateFeedInput } from '../../api';

const formSchema = object({
  webhookId: string().optional(),
  channelId: string(),
  title: string(),
});

type FormData = InferType<typeof formSchema>;

interface Props {
  feedId: string
  serverId: string
  onUpdated: (feed: Feed) => void;
}

export const SettingsForm: React.FC<Props> = ({
  feedId,
  serverId,
  onUpdated,
}) => {
  const { t } = useTranslation();
  const {
    feed,
    status: feedStatus,
  } = useFeed({
    feedId,
  });
  const {
    data: discordServerData,
    status: discordServerStatus,
  } = useDiscordServer({ serverId });
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
    channelId: feed?.channel,
    title: feed?.title,
    webhookId: feed?.webhook?.id,
  };
  const {
    handleSubmit,
    control,
    reset,
    formState: {
      isDirty,
      isSubmitting,
    },
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
        details: {},
      };

      if (formData.webhookId !== undefined && formData.webhookId !== feed?.webhook?.id) {
        input.details.webhookId = formData.webhookId;
      }

      if (formData.channelId !== feed?.channel) {
        input.details.channelId = formData.channelId;
      }

      if (formData.title !== feed?.title) {
        input.details.title = formData.title;
      }

      const updatedFeed = await mutateAsync(input);
      onUpdated(updatedFeed.result);
      await notifySuccess(t('features.feed.components.sidebar.updateSuccess'));
      reset({
        channelId: updatedFeed.result.channel,
        title: updatedFeed.result.title,
        webhookId: updatedFeed.result.webhook?.id || '',
      });
    } catch (err) {
      notifyError(t('common.errors.somethingWentWrong'), err as Error);
    }
  };

  useEffect(() => {
    resetForm();
  }, [feed]);

  const webhooksDisabled = discordServerStatus !== 'success'
  || !discordServerData?.benefits.webhooks;

  const isLoading = feedStatus === 'loading'
    || discordWebhooksStatus === 'loading';

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Stack spacing={4}>
        <FormControl>
          <FormLabel htmlFor="title">
            {t('features.feed.components.sidebar.titleFormLabel')}
          </FormLabel>
          <Controller
            name="title"
            control={control}
            render={({ field }) => <Input {...field} />}
          />
          <FormHelperText>
            {t('features.feed.components.sidebar.titleFormHint')}
          </FormHelperText>
        </FormControl>
        <FormControl>
          <FormLabel htmlFor="channelId">
            {t('features.feed.components.sidebar.channelFormLabel')}
          </FormLabel>
          <Controller
            name="channelId"
            control={control}
            render={({ field }) => (
              <DiscordChannelDropdown
                onBlur={field.onBlur}
                onChange={field.onChange}
                serverId={serverId}
                value={field.value}
              />
            )}
          />
        </FormControl>
        <FormControl>
          <FormLabel htmlFor="webhook">
            {t('features.feed.components.sidebar.webhookFormLabel')}

          </FormLabel>
          <Controller
            name="webhookId"
            control={control}
            render={({ field }) => (
              <ThemedSelect
                loading={isLoading}
                isDisabled={webhooksDisabled || isSubmitting || isLoading}
                isClearable
                options={discordWebhooks?.map((webhook) => ({
                  label: webhook.name,
                  value: webhook.id,
                  icon: webhook.avatarUrl,
                })) || []}
                onChange={field.onChange}
                onBlur={field.onBlur}
                value={field.value}
              />
            )}
          />
          <Stack>
            <FormHelperText>
              {!webhooksDisabled
                  && t('features.feed.components.sidebar.webhooksInputHelperText')}
              {webhooksDisabled && (
              <Text color="orange.500">
                {t('features.feed.components.sidebar.webhooksPremiumDisabled')}
              </Text>
              )}
            </FormHelperText>
            {!webhooksDisabled && discordWebhooksError && (
            <Alert status="error">
              <Box>
                <AlertTitle>
                  {t('features.feed.components.sidebar.failedToGetWebhooks')}
                </AlertTitle>
                <AlertDescription>
                  {discordWebhooksError.message}
                </AlertDescription>
              </Box>
            </Alert>
            )}
          </Stack>
        </FormControl>
        <Flex justifyContent="flex-end">
          <HStack>
            <Button
              onClick={() => reset()}
              variant="ghost"
              disabled={!isDirty || isSubmitting}
            >
              {t('features.feed.components.sidebar.resetButton')}
            </Button>
            <Button
              type="submit"
              colorScheme="blue"
              disabled={isSubmitting || !isDirty}
              isLoading={isSubmitting}
            >
              {t('features.feed.components.sidebar.saveButton')}
            </Button>
          </HStack>
        </Flex>
      </Stack>
    </form>
  );
};
