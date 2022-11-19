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
  useDisclosure,
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
import { useFeeds } from '../../hooks/useFeeds';
import { useCreateFeed } from '../../hooks';
import { notifyError } from '@/utils/notifyError';

const formSchema = object({
  channelId: string().required(),
  title: string().required(),
  url: string().url().required(),
});

type FormData = InferType<typeof formSchema>;

export const AddFeedDialog: React.FC = () => {
  const { serverId } = useParams<RouteParams>();
  const { isOpen, onOpen, onClose } = useDisclosure();
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
  const { refetch: refetchFeeds } = useFeeds({ serverId });
  const { mutateAsync } = useCreateFeed();

  const loadingChannels = status === 'loading';

  const onSubmit = async ({ channelId, title, url }: FormData) => {
    try {
      await mutateAsync({
        details: {
          channelId,
          feeds: [{
            title,
            url,
          }],
        },
      });

      await refetchFeeds();
      reset();
      onClose();
    } catch (err) {
      notifyError(t('features.feed.components.addFeedDialog.failedToAdd'), err as Error);
    }
  };

  useEffect(() => {
    reset();
  }, [isOpen]);

  return (
    <>
      <Button
        colorScheme="blue"
        onClick={onOpen}
      >
        {t('features.feed.components.addFeedDialog.addButton')}
      </Button>
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>{t('features.feed.components.addFeedDialog.title')}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <form id="addfeed" onSubmit={handleSubmit(onSubmit)}>
              <Stack spacing={4}>
                <FormControl isInvalid={!!errors.title}>
                  <FormLabel>
                    {t('features.feed.components.addFeedDialog.formTitleLabel')}

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
                    {t('features.feed.components.addFeedDialog.formTitleDescription')}

                  </FormHelperText>
                  <FormErrorMessage>
                    {errors.title?.message}
                  </FormErrorMessage>
                </FormControl>
                <FormControl isInvalid={!!errors.channelId}>
                  <FormLabel>
                    {t('features.feed.components.addFeedDialog.formChannelLabel')}

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
                <FormControl isInvalid={!!errors.url}>
                  <FormLabel>
                    {t('features.feed.components.addFeedDialog.formLinkLabel')}
                  </FormLabel>
                  <Controller
                    name="url"
                    control={control}
                    render={({ field }) => (
                      <Input
                        disabled={isSubmitting}
                        {...field}
                      />
                    )}
                  />
                  <FormHelperText>
                    {t('features.feed.components.addFeedDialog.formLinkDescription')}
                  </FormHelperText>
                  <FormErrorMessage>
                    {errors.url?.message}
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
              {t('features.feed.components.addFeedDialog.cancelButton')}
            </Button>
            <Button
              colorScheme="blue"
              type="submit"
              form="addfeed"
              isLoading={isSubmitting}
              isDisabled={!isDirty || isSubmitting}
            >
              {t('features.feed.components.addFeedDialog.saveButton')}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};
