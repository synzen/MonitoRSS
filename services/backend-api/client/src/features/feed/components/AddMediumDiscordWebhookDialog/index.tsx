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
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
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
import { useFeed } from '../../hooks';
import { DiscordChannelName } from '../../../discordServers/components/DiscordChannelName';

const formSchema = object({
  webhookId: string().optional(),
  name: string().optional(),
  iconUrl: string().optional(),
});

interface Props {
  onClose: () => void;
  isOpen: boolean;
}

type FormData = InferType<typeof formSchema>;

export const AddMediumDiscordWebhookDialog: React.FC<Props> = ({
  onClose,
  isOpen,
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
    webhookId: feed?.webhook?.id,
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

  const onSubmit = async ({ webhookId, name }: FormData) => {
  };

  useEffect(() => {
    reset();
  }, [isOpen]);

  const webhooksDisabled = discordServerStatus !== 'success'
  || !discordServerData?.benefits.webhooks;

  const isLoading = feedStatus === 'loading'
    || discordWebhooksStatus === 'loading';

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalOverlay />
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
              onClick={() => reset()}
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
    </Modal>
  );
};
