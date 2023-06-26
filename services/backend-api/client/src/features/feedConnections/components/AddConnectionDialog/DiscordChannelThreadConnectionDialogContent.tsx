import {
  Button,
  FormControl,
  FormErrorMessage,
  FormHelperText,
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
} from "@chakra-ui/react";
import { yupResolver } from "@hookform/resolvers/yup";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { InferType, object, string } from "yup";
import { useEffect } from "react";

import RouteParams from "../../../../types/RouteParams";
import { notifyError } from "../../../../utils/notifyError";
import { useCreateDiscordChannelConnection } from "../../hooks";

const formSchema = object({
  name: string().required("Name is required"),
  threadId: string().required("Thread ID is required"),
});

interface Props {
  onClose: () => void;
  isOpen: boolean;
}

type FormData = InferType<typeof formSchema>;

export const DiscordChannelThreadConnectionDialogContent: React.FC<Props> = ({
  onClose,
  isOpen,
}) => {
  const { feedId } = useParams<RouteParams>();
  const { t } = useTranslation();
  const {
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting, isValid },
  } = useForm<FormData>({
    resolver: yupResolver(formSchema),
    mode: "all",
  });
  const { mutateAsync } = useCreateDiscordChannelConnection();

  const onSubmit = async ({ threadId, name }: FormData) => {
    if (!feedId) {
      throw new Error("Feed ID missing while creating discord channel connection");
    }

    try {
      await mutateAsync({
        feedId,
        details: {
          name,
          channelId: threadId,
        },
      });
      onClose();
    } catch (err) {
      notifyError(t("common.errors.somethingWentWrong"), err as Error);
    }
  };

  useEffect(() => {
    reset();
  }, [isOpen]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} closeOnOverlayClick={!isSubmitting}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>
          {t("features.feed.components.addDiscordChannelThreadConnectionDialog.title")}
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <form id="addfeed" onSubmit={handleSubmit(onSubmit)}>
            <Stack spacing={4}>
              <FormControl isInvalid={!!errors.threadId}>
                <FormLabel>
                  {t(
                    "features.feed.components.addDiscordChannelThreadConnectionDialog.formTheadIdLabel"
                  )}
                </FormLabel>
                <Controller
                  name="threadId"
                  control={control}
                  render={({ field }) => <Input {...field} />}
                />
                <FormErrorMessage>{errors.threadId?.message}</FormErrorMessage>
              </FormControl>
              <FormControl isInvalid={!!errors.name}>
                <FormLabel>
                  {t(
                    "features.feed.components.addDiscordChannelThreadConnectionDialog.formNameLabel"
                  )}
                </FormLabel>
                <Controller
                  name="name"
                  control={control}
                  render={({ field }) => <Input {...field} />}
                />
                {errors.name && <FormErrorMessage>{errors.name.message}</FormErrorMessage>}
                <FormHelperText>
                  {t(
                    "features.feed.components" +
                      ".addDiscordChannelThreadConnectionDialog.formNameDescription"
                  )}
                </FormHelperText>
              </FormControl>
            </Stack>
          </form>
        </ModalBody>
        <ModalFooter>
          <HStack>
            <Button variant="ghost" mr={3} onClick={onClose} isDisabled={isSubmitting}>
              {t("common.buttons.cancel")}
            </Button>
            <Button
              colorScheme="blue"
              type="submit"
              form="addfeed"
              isLoading={isSubmitting}
              isDisabled={isSubmitting || !isValid}
            >
              {t("common.buttons.save")}
            </Button>
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
