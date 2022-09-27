import {
  Alert,
  AlertDescription,
  AlertTitle,
  Box,
  Button,
  FormControl,
  FormHelperText,
  FormLabel,
  Input,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Stack,
  Text,
} from '@chakra-ui/react';
import { yupResolver } from '@hookform/resolvers/yup';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { InferType, object, string } from 'yup';
import { useEffect } from 'react';
import { useDiscordServer } from '@/features/discordServers';
import RouteParams from '../../../../types/RouteParams';
import { ThemedSelect } from '@/components';
import { useDiscordWebhooks } from '../../../discordWebhooks';
import { useCreateDiscordWebhookConnection, useFeed } from '../../hooks';
import { DiscordChannelName } from '../../../discordServers/components/DiscordChannelName';
import { notifyError } from '../../../../utils/notifyError';

const formSchema = object({
  webhookId: string().required(),
  name: string().optional(),
  iconUrl: string().optional(),
});

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

type FormData = InferType<typeof formSchema>;

export const DiscordWebhookConnectionContent: React.FC<Props> = ({
  isOpen,
  onClose,
}) => {
  const { serverId, feedId } = useParams<RouteParams>();
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
  const defaultFormValues: FormData = {
    webhookId: feed?.webhook?.id as string,
    name: feed?.webhook?.name,
    iconUrl: feed?.webhook?.iconUrl,
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
  const { mutateAsync } = useCreateDiscordWebhookConnection();

  const onSubmit = async ({ webhookId, name, iconUrl }: FormData) => {
    if (!feedId) {
      throw new Error('Feed ID missing while creating discord channel connection');
    }

    try {
      await mutateAsync({
        feedId,
        details: {
          webhookId,
          name,
          iconUrl,
        },
      });
      onClose();
    } catch (err) {
      notifyError(t('features.feed.components.addDiscordChannelConnectionDialog'
      + '.failedToAdd'), err as Error);
    }
  };

  useEffect(() => {
    reset();
  }, [isOpen]);

  const webhooksDisabled = discordServerStatus !== 'success'
  || !discordServerData?.benefits.webhooks;

  const isLoading = feedStatus === 'loading'
    || discordWebhooksStatus === 'loading';

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <ModalContent>
        <ModalHeader>
          {t('features.feed.components.addDiscordWebhookConnectionDialog.title')}

        </ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          {webhooksDisabled && (
            <Text color="orange.500">
              {t(
                'features.feed.components.addDiscordWebhookConnectionDialog'
                + '.webhooksPremiumDisabled',
              )}
            </Text>
          )}
          {!webhooksDisabled && (
            <Stack spacing={4}>
              <FormControl>
                <FormLabel htmlFor="webhook">
                  {t('features.feed.components.addDiscordWebhookConnectionDialog.webhookFormLabel')}
                </FormLabel>
                <Controller
                  name="webhookId"
                  control={control}
                  render={({ field }) => (
                    <ThemedSelect
                      loading={isLoading}
                      isDisabled={isSubmitting || isLoading}
                      isClearable
                      options={discordWebhooks?.map((webhook) => ({
                        label: (
                          <span>
                            {webhook.name}
                            {' '}
                            (
                            <DiscordChannelName serverId={serverId} channelId={webhook.channelId} />
                            )
                          </span>
                        ),
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
                    {t('features.feed.components.addDiscordWebhookConnectionDialog'
                    + '.webhooksInputHelperText')}
                  </FormHelperText>
                  {discordWebhooksError && (
                  <Alert status="error">
                    <Box>
                      <AlertTitle>
                        {t('features.feed.components.'
                        + 'addDiscordWebhookConnectionDialog.failedToGetWebhooks')}
                      </AlertTitle>
                      <AlertDescription>
                        {discordWebhooksError.message}
                      </AlertDescription>
                    </Box>
                  </Alert>
                  )}
                </Stack>
              </FormControl>
              <FormControl>
                <FormLabel htmlFor="title">
                  {t('features.feed.components.addDiscordWebhookConnectionDialog.webhookNameLabel')}
                </FormLabel>
                <Controller
                  name="name"
                  control={control}
                  render={({ field }) => (
                    <Input
                      placeholder="Optional"
                      {...field}
                      isDisabled={isSubmitting}
                    />
                  )}
                />
                <FormHelperText>
                  {t('features.feed.components.addDiscordWebhookConnectionDialog'
                  + '.webhookNameDescription')}
                </FormHelperText>
              </FormControl>
              <FormControl>
                <FormLabel htmlFor="iconUrl">
                  {t('features.feed.components.addDiscordWebhookConnectionDialog'
                  + '.webhookIconUrlLabel')}
                </FormLabel>
                <Controller
                  name="iconUrl"
                  control={control}
                  render={({ field }) => (
                    <Input
                      placeholder="Optional"
                      {...field}
                      isDisabled={isSubmitting}
                    />
                  )}
                />
                <FormHelperText>
                  {t(
                    'features.feed.components.addDiscordWebhookConnectionDialog'
                    + '.webhookIconUrlDescription',
                  )}
                </FormHelperText>
              </FormControl>
            </Stack>
          )}
        </ModalBody>
        <ModalFooter>
          <Button
            onClick={onClose}
            variant="ghost"
            disabled={!isDirty || isSubmitting}
          >
            {t('features.feed.components.addDiscordWebhookConnectionDialog.cancelButton')}
          </Button>
          <Button
            type="submit"
            colorScheme="blue"
            disabled={isSubmitting || !isDirty}
            isLoading={isSubmitting}
          >
            {t('features.feed.components.addDiscordWebhookConnectionDialog.saveButton')}
          </Button>
        </ModalFooter>
      </ModalContent>
    </form>
  );
};
