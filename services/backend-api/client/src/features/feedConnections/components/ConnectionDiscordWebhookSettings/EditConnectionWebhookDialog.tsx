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
  useDisclosure,
} from '@chakra-ui/react';
import { yupResolver } from '@hookform/resolvers/yup';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { InferType, object, string } from 'yup';
import React, { useEffect } from 'react';
import { useDiscordServer } from '@/features/discordServers';
import { ThemedSelect } from '@/components';
import { useDiscordWebhooks } from '../../../discordWebhooks';
import { useFeed } from '../../../feed/hooks';
import { DiscordChannelName } from '../../../discordServers/components/DiscordChannelName';

const formSchema = object({
  name: string().optional(),
  webhook: object({
    id: string().required('This is a required field'),
    name: string().optional(),
    iconUrl: string().optional(),
  }),
});

type FormData = InferType<typeof formSchema>;

interface Props {
  serverId?: string
  feedId?: string
  defaultValues: Required<FormData>
  onUpdate: (data: FormData) => Promise<void>
  trigger: React.ReactElement
}

export const EditConnectionWebhookDialog: React.FC<Props> = ({
  serverId,
  feedId,
  defaultValues,
  onUpdate,
  trigger,
}) => {
  const { isOpen, onClose, onOpen } = useDisclosure();
  const { t } = useTranslation();
  const {
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
  const {
    handleSubmit,
    control,
    reset,
    formState: {
      isDirty,
      isSubmitting,
      errors,
    },
  } = useForm<FormData>({
    resolver: yupResolver(formSchema),
    defaultValues,
  });

  const onSubmit = async (formData: FormData) => {
    await onUpdate(formData);
    onClose();
    reset(formData);
  };

  useEffect(() => {
    reset();
  }, [isOpen]);

  const webhooksDisabled = discordServerStatus !== 'success'
  || !discordServerData?.benefits.webhooks;

  const isLoading = feedStatus === 'loading'
    || discordWebhooksStatus === 'loading';

  return (
    <>
      {React.cloneElement(trigger, { onClick: onOpen })}
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <form onSubmit={handleSubmit(onSubmit)}>
            <ModalHeader>
              {t('features.feed.components.updateDiscordWebhookConnectionDialog.title')}

            </ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              {webhooksDisabled && (
              <Text color="orange.500">
                {t('common.errors.supporterRequiredAccess')}
              </Text>
              )}
              {!webhooksDisabled && (
              <Stack spacing={4}>
                <FormControl isInvalid={!!errors.name}>
                  <FormLabel>
                    {t('features.feed.components.addDiscordWebhookConnectionDialog.formNameLabel')}
                  </FormLabel>
                  <Controller
                    name="name"
                    control={control}
                    render={({ field }) => (
                      <Input {...field} />
                    )}
                  />
                  {errors.name && (
                  <FormErrorMessage>
                    {errors.name.message}
                  </FormErrorMessage>
                  )}
                  <FormHelperText>
                    {t('features.feed.components'
                  + '.addDiscordWebhookConnectionDialog.formNameDescription')}
                  </FormHelperText>
                </FormControl>
                <FormControl isInvalid={!!errors?.webhook?.id}>
                  <FormLabel htmlFor="webhook">
                    {t('features.feed.components'
                    + '.addDiscordWebhookConnectionDialog.webhookFormLabel')}
                  </FormLabel>
                  <Controller
                    name="webhook.id"
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
                              <DiscordChannelName
                                serverId={serverId}
                                channelId={webhook.channelId}
                              />
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
                    {errors.webhook && (
                      <FormErrorMessage>
                        {errors.webhook.message}
                      </FormErrorMessage>
                    )}
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
                  <FormLabel>
                    {t('features.feed.components'
                    + '.addDiscordWebhookConnectionDialog.webhookNameLabel')}
                  </FormLabel>
                  <Controller
                    name="webhook.name"
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
                  <FormLabel>
                    {t('features.feed.components.addDiscordWebhookConnectionDialog'
                  + '.webhookIconUrlLabel')}
                  </FormLabel>
                  <Controller
                    name="webhook.iconUrl"
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
              <HStack>
                <Button
                  onClick={onClose}
                  variant="ghost"
                  disabled={isSubmitting}
                >
                  {t('common.buttons.cancel')}
                </Button>
                <Button
                  type="submit"
                  colorScheme="blue"
                  disabled={isSubmitting || !isDirty}
                  isLoading={isSubmitting}
                >
                  {t('common.buttons.save')}
                </Button>
              </HStack>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>
    </>
  );
};
