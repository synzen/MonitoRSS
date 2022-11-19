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
import React, { useEffect } from 'react';

const formSchema = object({
  title: string().optional(),
  url: string().url().optional(),
});

type FormData = InferType<typeof formSchema>;

interface Props {
  onUpdate: (data: FormData) => Promise<void>
  trigger: React.ReactElement
  defaultValues: Required<FormData>
}

export const EditUserFeedDialog: React.FC<Props> = ({
  onUpdate,
  trigger,
  defaultValues,
}) => {
  const { isOpen, onClose, onOpen } = useDisclosure();
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
    defaultValues,
  });

  const onSubmit = async ({ title, url }: FormData) => {
    await onUpdate({ title, url });
    onClose();
    reset({ title, url });
  };

  useEffect(() => {
    reset(defaultValues);
  }, [isOpen]);

  return (
    <>
      {React.cloneElement(trigger, { onClick: onOpen })}
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            {t('features.feed.components.updateUserFeedDialog.title')}
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <form id="update-user-feed" onSubmit={handleSubmit(onSubmit)}>
              <Stack spacing={4}>
                <FormControl isInvalid={!!errors.title}>
                  <FormLabel>
                    {t('features.feed.components.addFeedDialog.formTitleLabel')}
                  </FormLabel>
                  <Controller
                    name="title"
                    control={control}
                    render={({ field }) => (
                      <Input {...field} />
                    )}
                  />
                  {errors.title && (
                  <FormErrorMessage>
                    {errors.title.message}
                  </FormErrorMessage>
                  )}
                  <FormHelperText>
                    {t('features.feed.components'
                  + '.addFeedDialog.formTitleDescription')}
                  </FormHelperText>
                </FormControl>
                <FormControl isInvalid={!!errors.title}>
                  <FormLabel>
                    {t('features.feed.components.addFeedDialog.formLinkLabel')}
                  </FormLabel>
                  <Controller
                    name="url"
                    control={control}
                    render={({ field }) => (
                      <Input {...field} />
                    )}
                  />
                  {errors.url && (
                  <FormErrorMessage>
                    {errors.url.message}
                  </FormErrorMessage>
                  )}
                  <FormHelperText>
                    {t('features.feed.components'
                  + '.addFeedDialog.formLinkDescription')}
                  </FormHelperText>
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
              {t('common.buttons.cancel')}
            </Button>
            <Button
              colorScheme="blue"
              type="submit"
              form="update-user-feed"
              isLoading={isSubmitting}
              isDisabled={!isDirty || isSubmitting}
            >
              {t('common.buttons.save')}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};
