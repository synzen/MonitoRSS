import {
  Box,
  Button,
  FormControl,
  FormErrorMessage,
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
  useDisclosure,
} from "@chakra-ui/react";
import { yupResolver } from "@hookform/resolvers/yup";
import { cloneElement, useEffect, useRef } from "react";
import { Controller, useForm } from "react-hook-form";
import { InferType, object, string } from "yup";
import { useTranslation } from "react-i18next";
import { ExternalLinkIcon } from "@chakra-ui/icons";
import { useCreateUserFeedClone } from "../../hooks";
import {
  InlineErrorAlert,
  InlineErrorIncompleteFormAlert,
} from "../../../../components/InlineErrorAlert";
import { usePageAlertContext } from "../../../../contexts/PageAlertContext";
import { pages } from "../../../../constants";

const formSchema = object({
  title: string().required("Title is required"),
  url: string().required().matches(/^http/, {
    message: "Must be a valid URL",
  }),
});

type FormData = InferType<typeof formSchema>;

interface Props {
  feedId: string;
  defaultValues: {
    title: string;
    url: string;
  };
  trigger: React.ReactElement;
}

export const CloneUserFeedDialog = ({ feedId, defaultValues, trigger }: Props) => {
  const {
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting, isSubmitted, isValid },
  } = useForm<FormData>({
    resolver: yupResolver(formSchema),
    defaultValues,
  });
  const { isOpen, onOpen, onClose } = useDisclosure();
  const initialRef = useRef<HTMLInputElement>(null);
  const { mutateAsync, error, reset: resetError } = useCreateUserFeedClone();
  const { t } = useTranslation();
  const { createSuccessAlert } = usePageAlertContext();

  useEffect(() => {
    reset(defaultValues);
    resetError();
  }, [isOpen]);

  const onSubmit = async ({ title, url }: FormData) => {
    try {
      const {
        result: { id },
      } = await mutateAsync({ feedId, details: { title, url } });

      createSuccessAlert({
        title: `Successfully cloned feed to: ${title}.`,
        description: (
          <Box mt={2}>
            <Button
              as={Link}
              href={pages.userFeed(id)}
              target="_blank"
              rightIcon={<ExternalLinkIcon />}
            >
              View cloned feed
            </Button>
          </Box>
        ),
      });

      onClose();
      reset({ title });
    } catch (err) {}
  };

  const formErrorCount = Object.keys(errors).length;

  return (
    <>
      {cloneElement(trigger, { onClick: onOpen })}
      <Modal isOpen={isOpen} onClose={onClose} initialFocusRef={initialRef}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Clone feed</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Stack spacing={4}>
              <form id="clonefeed" onSubmit={handleSubmit(onSubmit)}>
                <Stack spacing={4}>
                  <FormControl isInvalid={!!errors.title} isRequired>
                    <FormLabel>Title</FormLabel>
                    <Controller
                      name="title"
                      control={control}
                      render={({ field }) => <Input {...field} ref={initialRef} bg="gray.800" />}
                    />
                    {errors.title && <FormErrorMessage>{errors.title.message}</FormErrorMessage>}
                  </FormControl>
                  <FormControl isInvalid={!!errors.url} isRequired>
                    <FormLabel>Feed Link</FormLabel>
                    <Controller
                      name="url"
                      control={control}
                      render={({ field }) => <Input type="url" {...field} bg="gray.800" />}
                    />
                    {errors.url && <FormErrorMessage>{errors.url.message}</FormErrorMessage>}
                  </FormControl>
                </Stack>
              </form>
              {error && (
                <InlineErrorAlert
                  title={t("common.errors.somethingWentWrong")}
                  description={error.message}
                />
              )}
              {isSubmitted && formErrorCount && (
                <InlineErrorIncompleteFormAlert fieldCount={formErrorCount} />
              )}
            </Stack>
          </ModalBody>
          <ModalFooter>
            <HStack>
              <Button variant="ghost" onClick={onClose}>
                <span>Cancel</span>
              </Button>
              <Button
                colorScheme="blue"
                type="submit"
                form="clonefeed"
                isLoading={isSubmitting}
                aria-disabled={isSubmitting || !isValid}
              >
                <span>Clone</span>
              </Button>
            </HStack>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};
