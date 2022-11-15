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
import { InferType, object, string } from 'yup';
import { useEffect } from 'react';
import { useCreateUserFeed, useUserFeeds } from '../../hooks';
import { notifyError } from '@/utils/notifyError';

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
  const { refetch: refetchFeeds } = useUserFeeds();
  const { mutateAsync } = useCreateUserFeed();

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
          <form onSubmit={handleSubmit(onSubmit)}>
            <ModalHeader>{t('features.feed.components.addFeedDialog.title')}</ModalHeader>
            <ModalCloseButton />
            <ModalBody>
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
                // form="addfeed"
                isLoading={isSubmitting}
                isDisabled={!isDirty || isSubmitting}
                onClick={() => console.log('c')}
              >
                {t('features.feed.components.addFeedDialog.saveButton')}
              </Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>
    </>
  );
};
