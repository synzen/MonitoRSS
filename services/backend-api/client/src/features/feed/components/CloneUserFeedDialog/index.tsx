import {
  Button,
  FormControl,
  FormErrorMessage,
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
  useDisclosure,
} from "@chakra-ui/react";
import { yupResolver } from "@hookform/resolvers/yup";
import { cloneElement, useEffect, useRef } from "react";
import { Controller, useForm } from "react-hook-form";
import { InferType, object, string } from "yup";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { pages } from "../../../../constants";
import { notifyError } from "../../../../utils/notifyError";
import { notifySuccess } from "../../../../utils/notifySuccess";
import { useCreateUserFeedClone } from "../../hooks";

const formSchema = object({
  title: string().required(),
  url: string().required(),
});

type FormData = InferType<typeof formSchema>;

interface Props {
  feedId: string;
  defaultValues: {
    title: string;
    url: string;
  };
  trigger: React.ReactElement;
  redirectOnSuccess?: boolean;
}

export const CloneUserFeedDialog = ({
  feedId,
  defaultValues,
  trigger,
  redirectOnSuccess,
}: Props) => {
  const {
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: yupResolver(formSchema),
    defaultValues,
  });
  const { isOpen, onOpen, onClose } = useDisclosure();
  const initialRef = useRef<HTMLInputElement>(null);
  const { mutateAsync } = useCreateUserFeedClone();
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    reset(defaultValues);
  }, [isOpen]);

  const onSubmit = async ({ title, url }: FormData) => {
    try {
      const {
        result: { id },
      } = await mutateAsync({ feedId, details: { title, url } });

      if (redirectOnSuccess) {
        navigate(pages.userFeed(id));
        notifySuccess(
          t("common.success.savedChanges"),
          "You are now viewing your newly cloned feed"
        );
      } else {
        notifySuccess("Successfully cloned");
      }

      onClose();
      reset({ title });
    } catch (err) {
      notifyError(t("common.errors.somethingWentWrong"), (err as Error).message);
    }
  };

  return (
    <>
      {cloneElement(trigger, { onClick: onOpen })}
      <Modal isOpen={isOpen} onClose={onClose} initialFocusRef={initialRef}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Clone feed</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <form id="clonefeed" onSubmit={handleSubmit(onSubmit)}>
              <Stack spacing={4}>
                <FormControl isInvalid={!!errors.title}>
                  <FormLabel>Title</FormLabel>
                  <Controller
                    name="title"
                    control={control}
                    render={({ field }) => <Input {...field} ref={initialRef} bg="gray.800" />}
                  />
                  {errors.title && <FormErrorMessage>{errors.title.message}</FormErrorMessage>}
                </FormControl>
                <FormControl isInvalid={!!errors.url}>
                  <FormLabel>RSS Feed Link</FormLabel>
                  <Controller
                    name="url"
                    control={control}
                    render={({ field }) => <Input {...field} bg="gray.800" />}
                  />
                  {errors.url && <FormErrorMessage>{errors.url.message}</FormErrorMessage>}
                </FormControl>
              </Stack>
            </form>
          </ModalBody>
          <ModalFooter>
            <HStack>
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button colorScheme="blue" type="submit" form="clonefeed" isLoading={isSubmitting}>
                Clone
              </Button>
            </HStack>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};
