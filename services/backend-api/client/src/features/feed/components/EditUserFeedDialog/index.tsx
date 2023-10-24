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
} from "@chakra-ui/react";
import { yupResolver } from "@hookform/resolvers/yup";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { InferType, object, string } from "yup";
import React, { useEffect, useRef } from "react";

const formSchema = object({
  title: string().optional(),
  url: string().url().optional(),
});

type FormData = InferType<typeof formSchema>;

interface Props {
  onUpdate: (data: FormData) => Promise<void>;
  defaultValues: Required<FormData>;
  onCloseRef?: React.RefObject<HTMLButtonElement>;
  isOpen: boolean;
  onClose: () => void;
}

export const EditUserFeedDialog: React.FC<Props> = ({
  onUpdate,
  defaultValues,
  onCloseRef,
  onClose,
  isOpen,
}) => {
  const { t } = useTranslation();
  const initialFocusRef = useRef<HTMLInputElement>(null);
  const {
    handleSubmit,
    control,
    reset,
    formState: { isDirty, errors, isSubmitting },
  } = useForm<FormData>({
    resolver: yupResolver(formSchema),
    mode: "all",
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
    <Modal
      finalFocusRef={onCloseRef}
      isOpen={isOpen}
      onClose={onClose}
      initialFocusRef={initialFocusRef}
    >
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>{t("features.feed.components.updateUserFeedDialog.title")}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <form id="update-user-feed" onSubmit={handleSubmit(onSubmit)}>
            <Stack spacing={4}>
              <FormControl isInvalid={!!errors.title}>
                <FormLabel>{t("features.feed.components.addFeedDialog.formTitleLabel")}</FormLabel>
                <Controller
                  name="title"
                  control={control}
                  render={({ field }) => (
                    <Input {...field} tabIndex={0} ref={initialFocusRef} bg="gray.800" />
                  )}
                />
                {errors.title && <FormErrorMessage>{errors.title.message}</FormErrorMessage>}
                <FormHelperText>
                  {t("features.feed.components.addFeedDialog.formTitleDescription")}
                </FormHelperText>
              </FormControl>
              <FormControl isInvalid={!!errors.title}>
                <FormLabel>RSS Feed Link</FormLabel>
                <Controller
                  name="url"
                  control={control}
                  render={({ field }) => <Input {...field} tabIndex={0} bg="gray.800" />}
                />
                {errors.url && <FormErrorMessage>{errors.url.message}</FormErrorMessage>}
                <FormHelperText>
                  {t("features.feed.components.addFeedDialog.formLinkDescription")}
                </FormHelperText>
              </FormControl>
            </Stack>
          </form>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={onClose} isDisabled={isSubmitting}>
            {t("common.buttons.cancel")}
          </Button>
          <Button
            colorScheme="blue"
            type="submit"
            form="update-user-feed"
            isLoading={isSubmitting}
            isDisabled={!isDirty || isSubmitting}
          >
            {t("common.buttons.save")}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
