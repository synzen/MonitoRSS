import {
  Alert,
  AlertDescription,
  AlertTitle,
  Box,
  Button,
  Flex,
  FormControl, FormHelperText, FormLabel, HStack, Stack, Text,
} from '@chakra-ui/react';
import { useForm, Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { InferType, object, string } from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
import { useEffect } from 'react';
import { ThemedSelect } from '@/components';
import { useFeed } from '../../hooks';
import { useDiscordServer } from '@/features/discordServers';
import { useDiscordWebhooks } from '@/features/discordWebhooks';

import { notifySuccess } from '@/utils/notifySuccess';
import { useUpdateFeed } from '../../hooks/useUpdateFeed';

const formSchema = object({
  webhookId: string().optional(),
});

type FormData = InferType<typeof formSchema>;

interface Props {
  feedId: string
  serverId: string
}

export const SettingsForm: React.FC<Props> = ({
  feedId,
  serverId,
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

  const {
    handleSubmit,
    control,
    reset,
    setValue,
    formState: {
      isDirty,
      isSubmitting,
    },
  } = useForm<FormData>({
    resolver: yupResolver(formSchema),
    defaultValues: {
      webhookId: feed?.webhook?.id || '',
    },
  });

  const onSubmit = async (formData: FormData) => {
    const updatedFeed = await mutateAsync({
      feedId,
      details: {
        webhookId: formData.webhookId,
      },
    });
    await notifySuccess(t('features.feed.components.sidebar.updateSuccess'));
    reset({
      webhookId: updatedFeed.result.webhook?.id || '',
    });
  };

  useEffect(() => {
    setValue('webhookId', feed?.webhook?.id || '');
  }, [feed]);

  const webhooksDisabled = discordServerStatus !== 'success'
  || !discordServerData?.benefits.webhooks;

  const isLoading = feedStatus === 'loading'
    || discordWebhooksStatus === 'loading';

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Stack spacing={6}>
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
