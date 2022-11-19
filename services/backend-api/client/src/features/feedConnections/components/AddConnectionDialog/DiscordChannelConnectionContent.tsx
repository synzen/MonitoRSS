import {
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
} from '@chakra-ui/react';
import { yupResolver } from '@hookform/resolvers/yup';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { InferType, object, string } from 'yup';
import { useEffect } from 'react';
import { DiscordServerSearchSelectv2, useDiscordServerChannels } from '@/features/discordServers';
import RouteParams from '../../../../types/RouteParams';
import { ThemedSelect } from '@/components';
import { notifyError } from '../../../../utils/notifyError';
import { useCreateDiscordChannelConnection } from '../../hooks';

const formSchema = object({
  name: string().required(),
  channelId: string().required(),
  serverId: string().required(),
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
  const { feedId } = useParams<RouteParams>();
  const { t } = useTranslation();
  const {
    handleSubmit,
    control,
    reset,
    formState: {
      errors,
      isSubmitting,
      isValid,
    },
    watch,
  } = useForm<FormData>({
    resolver: yupResolver(formSchema),
    mode: 'all',
  });
  const serverId = watch('serverId');
  const { data, error: channelsError, status } = useDiscordServerChannels({ serverId });
  const { mutateAsync } = useCreateDiscordChannelConnection();

  const loadingChannels = status === 'loading';

  const onSubmit = async ({ channelId, name }: FormData) => {
    if (!feedId) {
      throw new Error('Feed ID missing while creating discord channel connection');
    }

    try {
      await mutateAsync({
        feedId,
        details: {
          name,
          channelId,
        },
      });
      onClose();
    } catch (err) {
      notifyError(t('common.errors.somethingWentWrong'), err as Error);
    }
  };

  useEffect(() => {
    reset();
  }, [isOpen]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      closeOnOverlayClick={!isSubmitting}
    >
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>
          {t('features.feed.components.addDiscordChannelConnectionDialog.title')}
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <form id="addfeed" onSubmit={handleSubmit(onSubmit)}>
            <Stack spacing={4}>
              <FormControl isInvalid={!!errors.name}>
                <FormLabel>
                  {t('features.feed.components.addDiscordChannelConnectionDialog.formNameLabel')}
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
                  + '.addDiscordChannelConnectionDialog.formNameDescription')}
                </FormHelperText>
              </FormControl>
              <FormControl isInvalid={!!errors.serverId}>
                <FormLabel>
                  {t('features.feed.components.addDiscordChannelConnectionDialog.formServerLabel')}
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
                      isDisabled={isSubmitting || loadingChannels || !!channelsError || !serverId}
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
          <HStack>
            <Button
              variant="ghost"
              mr={3}
              onClick={onClose}
              disabled={isSubmitting}
            >
              {t('common.buttons.cancel')}
            </Button>
            <Button
              colorScheme="blue"
              type="submit"
              form="addfeed"
              isLoading={isSubmitting}
              isDisabled={isSubmitting || !isValid}
            >
              {t('features.feed.components.addDiscordChannelConnectionDialog.saveButton')}
            </Button>
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
