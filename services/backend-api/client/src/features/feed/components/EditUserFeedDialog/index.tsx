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
import {
  InlineErrorAlert,
  InlineErrorIncompleteFormAlert,
} from "../../../../components/InlineErrorAlert";

const formSchema = object({
  title: string().optional(),
  url: string().optional(),
});

type FormData = InferType<typeof formSchema>;

interface Props {
  onUpdate: (data: FormData) => Promise<void>;
  defaultValues: Required<FormData>;
  onCloseRef?: React.RefObject<HTMLButtonElement>;
  isOpen: boolean;
  onClose: () => void;
  error?: string;
}

export const EditUserFeedDialog: React.FC<Props> = ({
  onUpdate,
  defaultValues,
  onCloseRef,
  onClose,
  isOpen,
  error,
}) => {
  const { t } = useTranslation();
  const initialFocusRef = useRef<HTMLInputElement>(null);
  const {
    handleSubmit,
    control,
    reset,
    formState: { isDirty, errors, isSubmitting, isSubmitted },
  } = useForm<FormData>({
    resolver: yupResolver(formSchema),
    mode: "all",
    defaultValues,
  });

  const onSubmit = async ({ title, url }: FormData) => {
    try {
      if (!isDirty) {
        onClose();

        return;
      }

      await onUpdate({ title, url });
      onClose();
      reset({ title, url });
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    reset(defaultValues);
  }, [isOpen]);

  const formErrorCount = Object.keys(errors).length;

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
          <Stack spacing={4}>
            <form id="update-user-feed" onSubmit={handleSubmit(onSubmit)}>
              <Stack spacing={4}>
                <FormControl isInvalid={!!errors.title}>
                  <FormLabel>
                    {t("features.feed.components.addFeedDialog.formTitleLabel")}
                  </FormLabel>
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
                    render={({ field }) => (
                      <Input type="url" {...field} tabIndex={0} bg="gray.800" />
                    )}
                  />
                  {errors.url && <FormErrorMessage>{errors.url.message}</FormErrorMessage>}
                  <FormHelperText>
                    {t("features.feed.components.addFeedDialog.formLinkDescription")}
                  </FormHelperText>
                </FormControl>
              </Stack>
            </form>
            {error && (
              <InlineErrorAlert title={t("common.errors.failedToSave")} description={error} />
            )}
            {isSubmitted && formErrorCount > 0 && (
              <InlineErrorIncompleteFormAlert fieldCount={formErrorCount} />
            )}
          </Stack>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={onClose} isDisabled={isSubmitting}>
            <span>{t("common.buttons.cancel")}</span>
          </Button>
          <Button
            colorScheme="blue"
            type="submit"
            form="update-user-feed"
            isLoading={isSubmitting}
            aria-disabled={isSubmitting}
          >
            <span>{t("common.buttons.save")}</span>
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
