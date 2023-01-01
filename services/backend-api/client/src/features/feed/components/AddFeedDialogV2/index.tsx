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
  Tooltip,
  useDisclosure,
} from '@chakra-ui/react';
import { yupResolver } from '@hookform/resolvers/yup';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { InferType, object, string } from 'yup';
import { useEffect } from 'react';
import { useCreateUserFeed, useUserFeeds } from '../../hooks';
import { notifyError } from '@/utils/notifyError';
import { useDiscordUserMe } from '../../../discordUser';

const formSchema = object({
  title: string().required(),
  url: string().url().required(),
});

type FormData = InferType<typeof formSchema>;

export const AddFeedDialogV2: React.FC = () => {
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
  });
  const { refetch: refetchFeeds, data } = useUserFeeds();
  const { mutateAsync } = useCreateUserFeed();
  const {
    data: discordUserMe,
  } = useDiscordUserMe();

  const onSubmit = async ({ title, url }: FormData) => {
    try {
      await mutateAsync({
        details: {
          title,
          url,
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

  const isUnderLimit = data?.total && discordUserMe?.maxUserFeeds
    && data.total < discordUserMe.maxUserFeeds;

  return (
    <>
      <Tooltip label={t('features.userFeeds.components.addUserFeedDialog.overLimitHint')}>
        <Button
          colorScheme="blue"
          onClick={onOpen}
          disabled={!isUnderLimit}
        >
          {t('features.userFeeds.components.addUserFeedDialog.addButton')}
        </Button>
      </Tooltip>
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <form onSubmit={handleSubmit(onSubmit)}>
            <ModalHeader>
              {t('features.userFeeds.components.addUserFeedDialog.title')}
            </ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              <Stack spacing={4}>
                <FormControl isInvalid={!!errors.title}>
                  <FormLabel>
                    {t('features.userFeeds.components.addUserFeedDialog.formTitleLabel')}
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
                    {t('features.userFeeds.components.addUserFeedDialog.onlyForYourReferenceLabel')}
                  </FormHelperText>
                  <FormErrorMessage>
                    {errors.title?.message}
                  </FormErrorMessage>
                </FormControl>
                <FormControl isInvalid={!!errors.url}>
                  <FormLabel>
                    {t('features.userFeeds.components.addUserFeedDialog.formLinkLabel')}
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
                    {t('features.userFeeds.components.addUserFeedDialog.onlyForYourReferenceLabel')}
                  </FormHelperText>
                  <FormErrorMessage>
                    {errors.url?.message}
                  </FormErrorMessage>
                </FormControl>
              </Stack>
            </ModalBody>
            <ModalFooter>
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
                isLoading={isSubmitting}
                isDisabled={!isDirty || isSubmitting}
              >
                {t('common.buttons.save')}
              </Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>
    </>
  );
};
