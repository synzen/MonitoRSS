import {
  Button,
  FormControl,
  FormErrorMessage,
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

const formSchema = object({
  channelId: string().required(),
  title: string().required(),
});

interface Props {
  onClose: () => void;
  isOpen: boolean;
}

type FormData = InferType<typeof formSchema>;

export const AddMediumDiscordChannelDialog: React.FC<Props> = ({
  onClose,
  isOpen,
}) => {
  const { serverId } = useParams<RouteParams>();
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

  const loadingChannels = status === 'loading' || status === 'idle';

  const onSubmit = async ({ channelId, title }: FormData) => {
  };

  useEffect(() => {
    reset();
  }, [isOpen]);

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>
          {t('features.feed.components.addDiscordChannelConnectionDialog.title')}
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <form id="addfeed" onSubmit={handleSubmit(onSubmit)}>
            <Stack spacing={4}>
              <FormControl isInvalid={!!errors.title}>
                <FormLabel>
                  {t('features.feed.components.addDiscordChannelConnectionDialog.formTitleLabel')}

                </FormLabel>
                <Controller
                  name="title"
                  control={control}
                  render={({ field }) => (
                    <Input
                      disabled={isSubmitting}
                      {...field}
                    />
                  )}
                />
                <FormHelperText>
                  {t(
                    'features.feed.components.addDiscordChannelConnectionDialog'
                    + '.formTitleDescription',
                  )}

                </FormHelperText>
                <FormErrorMessage>
                  {errors.title?.message}
                </FormErrorMessage>
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
    </Modal>
  );
};
