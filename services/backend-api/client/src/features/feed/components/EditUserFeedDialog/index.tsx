import {
  Alert,
  AlertIcon,
  AlertTitle,
  Box,
  Button,
  FormControl,
  FormErrorMessage,
  FormHelperText,
  FormLabel,
  HStack,
  Input,
  Link,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Stack,
  Text,
} from "@chakra-ui/react";
import { yupResolver } from "@hookform/resolvers/yup";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { InferType, object, string } from "yup";
import React, { useEffect, useRef } from "react";
import { ExternalLinkIcon } from "@chakra-ui/icons";
import {
  InlineErrorAlert,
  InlineErrorIncompleteFormAlert,
} from "../../../../components/InlineErrorAlert";
import { useCreateUserFeedUrlValidation } from "../../hooks/useCreateUserFeedUrlValidation";

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
  error: updateError,
}) => {
  const { t } = useTranslation();
  const initialFocusRef = useRef<HTMLInputElement>(null);
  const {
    handleSubmit,
    control,
    reset,
    formState: { isDirty, errors, isSubmitting, isSubmitted },
    watch,
  } = useForm<FormData>({
    resolver: yupResolver(formSchema),
    mode: "all",
    defaultValues,
  });
  const [urlFromForm] = watch(["url"]);
  const {
    data: feedUrlValidationData,
    mutateAsync: createUserFeedUrlValidation,
    error: validationError,
    reset: resetValidationMutation,
    status: validationStatus,
  } = useCreateUserFeedUrlValidation();
  const error = updateError || validationError?.message;
  const isConfirming = !!feedUrlValidationData?.result.resolvedToUrl;
  const isLoading = isSubmitting || validationStatus === "loading";

  const onSubmit = async ({ title, url }: FormData) => {
    if (!isDirty) {
      onClose();

      return;
    }

    try {
      if (url && !feedUrlValidationData) {
        const { result } = await createUserFeedUrlValidation({ details: { url } });

        if (result.resolvedToUrl) {
          return;
        }
      }

      const useUrl = feedUrlValidationData?.result.resolvedToUrl || url;
      await onUpdate({ title, url: useUrl });
      onClose();
      reset({ title, url: useUrl });
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    reset(defaultValues);
    resetValidationMutation();
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
        <ModalHeader>
          {isConfirming
            ? "Confirm feed link change"
            : t("features.feed.components.updateUserFeedDialog.title")}
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Stack spacing={4}>
            {isConfirming && (
              <Stack spacing={4} role="alert">
                <Alert status="warning" role={undefined}>
                  <AlertIcon />
                  <AlertTitle>
                    The url you put in did not directly point to a valid feed.
                  </AlertTitle>
                </Alert>
                <Stack spacing={4} aria-live="polite">
                  <Box>
                    <Text display="inline">We found </Text>
                    <Link
                      display="inline"
                      color="blue.300"
                      href={feedUrlValidationData.result.resolvedToUrl || "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <HStack alignItems="center" display="inline">
                        <Text wordBreak="break-all" display="inline">
                          {feedUrlValidationData.result.resolvedToUrl}
                        </Text>
                        <ExternalLinkIcon ml={1} />
                      </HStack>
                    </Link>{" "}
                    <Text display="inline">
                      instead that might be related to the url you provided. Do you want to use this
                      feed link instead?
                    </Text>
                  </Box>
                  <span
                    style={{
                      fontWeight: 600,
                    }}
                  >
                    <Text display="inline">Your original link </Text>
                    <Link
                      display="inline"
                      color="blue.300"
                      href={urlFromForm || "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      wordBreak="break-all"
                    >
                      {urlFromForm}
                    </Link>
                    <Text display="inline"> will not be used.</Text>
                  </span>
                </Stack>
              </Stack>
            )}
            {!isConfirming && (
              <Stack spacing={4}>
                <FormControl isInvalid={!!errors.title} isRequired>
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
                <FormControl isInvalid={!!errors.title} isRequired>
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
            )}
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
            aria-disabled={isLoading}
            onClick={() => {
              if (isLoading) {
                return;
              }

              handleSubmit(onSubmit)();
            }}
          >
            <span>{isLoading && "Saving..."}</span>
            <span>{!isLoading && t("common.buttons.save")}</span>
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
