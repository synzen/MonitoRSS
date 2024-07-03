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
import { useCreateDiscordChannelConnectionClone } from "../../hooks";
import { pages } from "../../../../constants";
import { FeedConnectionType } from "../../../../types";
import { notifySuccess } from "../../../../utils/notifySuccess";
import { InlineErrorAlert } from "../../../../components";

const formSchema = object({
  name: string().required(),
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
  redirectOnSuccess?: boolean;
}

export const CloneDiscordConnectionCloneDialog = ({
  feedId,
  connectionId,
  type,
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
  const { mutateAsync: createChannelClone, error } = useCreateDiscordChannelConnectionClone();
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    reset(defaultValues);
  }, [isOpen]);

  const onSubmit = async ({ name }: FormData) => {
    try {
      let newConnectionId: string;

      if (type === FeedConnectionType.DiscordChannel) {
        const res = await createChannelClone({ feedId, connectionId, details: { name } });
        newConnectionId = res.result.id;
      } else {
        throw new Error(`Unsupported connection type when cloning discord connection: ${type}`);
      }

      if (redirectOnSuccess) {
        navigate(
          pages.userFeedConnection({
            connectionId: newConnectionId,
            feedId,
            connectionType: type,
          })
        );
        notifySuccess(
          t("common.success.savedChanges"),
          "You are now viewing your newly cloned connection"
        );
      } else {
        notifySuccess("Successfully cloned");
      }

      onClose();
      reset({ name });
    } catch (err) {}
  };

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
                <FormControl isInvalid={!!errors.name}>
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
            </Stack>
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
