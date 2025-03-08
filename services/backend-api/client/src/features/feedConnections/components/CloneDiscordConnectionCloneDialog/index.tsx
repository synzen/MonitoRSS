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
import { useTranslation } from "react-i18next";
import { useCreateDiscordChannelConnectionClone } from "../../hooks";
import { FeedConnectionType } from "../../../../types";
import { InlineErrorAlert, InlineErrorIncompleteFormAlert } from "../../../../components";
import { usePageAlertContext } from "../../../../contexts/PageAlertContext";

const formSchema = object({
  name: string().required("Name is required").max(250, "Name must be fewer than 250 characters"),
});

type FormData = InferType<typeof formSchema>;

interface Props {
  feedId: string;
  connectionId: string;
  type: FeedConnectionType;
  defaultValues: {
    name: string;
  };
  trigger: React.ReactElement;
}

export const CloneDiscordConnectionCloneDialog = ({
  feedId,
  connectionId,
  type,
  defaultValues,
  trigger,
}: Props) => {
  const {
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting, isValid, isSubmitted },
  } = useForm<FormData>({
    resolver: yupResolver(formSchema),
    defaultValues,
  });
  const { isOpen, onOpen, onClose } = useDisclosure();
  const initialRef = useRef<HTMLInputElement>(null);
  const { mutateAsync: createChannelClone, error } = useCreateDiscordChannelConnectionClone();
  const { t } = useTranslation();
  const { createSuccessAlert } = usePageAlertContext();

  useEffect(() => {
    reset(defaultValues);
  }, [isOpen]);

  const onSubmit = async ({ name }: FormData) => {
    try {
      if (type === FeedConnectionType.DiscordChannel) {
        await createChannelClone({ feedId, connectionId, details: { name } });
      } else {
        throw new Error(`Unsupported connection type when cloning discord connection: ${type}`);
      }

      createSuccessAlert({
        title: `Successfully created cloned connection: ${name}`,
      });

      onClose();
      reset({ name });
    } catch (err) {}
  };

  const formErrorCount = Object.keys(errors).length;

  return (
    <>
      {cloneElement(trigger, { onClick: onOpen })}
      <Modal isOpen={isOpen} onClose={onClose} initialFocusRef={initialRef}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Clone connection</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Stack>
              <form id="clonefeed" onSubmit={handleSubmit(onSubmit)}>
                <FormControl isInvalid={!!errors.name} isRequired>
                  <FormLabel>Name</FormLabel>
                  <Controller
                    name="name"
                    control={control}
                    render={({ field }) => <Input {...field} ref={initialRef} bg="gray.800" />}
                  />
                  {errors.name && <FormErrorMessage>{errors.name.message}</FormErrorMessage>}
                </FormControl>
              </form>
              {error && (
                <InlineErrorAlert
                  title={t("common.errors.somethingWentWrong")}
                  description={error.message}
                />
              )}
              {isSubmitted && formErrorCount > 0 && (
                <InlineErrorIncompleteFormAlert fieldCount={formErrorCount} />
              )}
            </Stack>
          </ModalBody>
          <ModalFooter>
            <HStack>
              <Button variant="ghost" onClick={onClose}>
                Cancel
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
