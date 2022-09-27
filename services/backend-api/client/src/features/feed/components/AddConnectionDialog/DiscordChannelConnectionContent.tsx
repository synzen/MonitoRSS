import {
  Button,
  FormControl,
  FormErrorMessage,
  FormLabel,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Stack,
} from '@chakra-ui/react';
import { yupResolver } from '@hookform/resolvers/yup';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { InferType, object, string } from 'yup';
import { useEffect } from 'react';
import { useDiscordServerChannels } from '@/features/discordServers';
import RouteParams from '../../../../types/RouteParams';
import { ThemedSelect } from '@/components';
import { notifyError } from '../../../../utils/notifyError';
import { useCreateDiscordChannelConnection } from '../../hooks';

const formSchema = object({
  channelId: string().required(),
});

interface Props {
  onClose: () => void;
  isOpen: boolean;
}

type FormData = InferType<typeof formSchema>;

export const DiscordChannelConnectionContent: React.FC<Props> = ({
  onClose,
  isOpen,
}) => {
  const { feedId, serverId } = useParams<RouteParams>();
  const { t } = useTranslation();
  const {
    handleSubmit,
    control,
    reset,
    formState: {
      isDirty,
      errors,
      isSubmitting,
    },
  } = useForm<FormData>({
    resolver: yupResolver(formSchema),
    mode: 'all',
  });
  const { data, error: channelsError, status } = useDiscordServerChannels({ serverId });
  const { mutateAsync } = useCreateDiscordChannelConnection();

  const loadingChannels = status === 'loading' || status === 'idle';

  const onSubmit = async ({ channelId }: FormData) => {
    if (!feedId) {
      throw new Error('Feed ID missing while creating discord channel connection');
    }

    try {
      await mutateAsync({
        feedId,
        details: {
          channelId,
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

  return (
    <ModalContent>
      <ModalHeader>
        {t('features.feed.components.addDiscordChannelConnectionDialog.title')}
      </ModalHeader>
      <ModalCloseButton />
      <ModalBody>
        <form id="addfeed" onSubmit={handleSubmit(onSubmit)}>
          <Stack spacing={4}>
            <FormControl isInvalid={!!errors.channelId}>
              <FormLabel>
                {t('features.feed.components.addDiscordChannelConnectionDialog.formChannelLabel')}

              </FormLabel>
              <Controller
                name="channelId"
                control={control}
                render={({ field }) => (
                  <ThemedSelect
                    loading={loadingChannels}
                    isDisabled={isSubmitting || loadingChannels || !!channelsError}
                    options={data?.results.map((channel) => ({
                      label: channel.name,
                      value: channel.id,
                    })) || []}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    value={field.value}
                  />
                )}
              />
              <FormErrorMessage>
                {errors.channelId?.message}
              </FormErrorMessage>
            </FormControl>
          </Stack>
        </form>
      </ModalBody>
      <ModalFooter>
        <Button
          variant="ghost"
          mr={3}
          onClick={onClose}
          disabled={isSubmitting}
        >
          {t('features.feed.components.addDiscordChannelConnectionDialog.cancelButton')}
        </Button>
        <Button
          colorScheme="blue"
          type="submit"
          form="addfeed"
          isLoading={isSubmitting}
          isDisabled={!isDirty || isSubmitting}
        >
          {t('features.feed.components.addDiscordChannelConnectionDialog.saveButton')}
        </Button>
      </ModalFooter>
    </ModalContent>
  );
};
