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
  Text,
} from "@chakra-ui/react";
import { yupResolver } from "@hookform/resolvers/yup";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { InferType, object, string } from "yup";
import { useEffect, useRef } from "react";

import RouteParams from "../../../../types/RouteParams";
import { useCreateDiscordChannelConnection } from "../../hooks";
import {
  DiscordActiveThreadDropdown,
  DiscordChannelDropdown,
  DiscordServerSearchSelectv2,
  GetDiscordChannelType,
} from "../../../discordServers";
import { notifySuccess } from "../../../../utils/notifySuccess";
import { InlineErrorAlert, InlineErrorIncompleteFormAlert } from "../../../../components";

const formSchema = object({
  name: string().required("Name is required").max(250, "Name must be less than 250 characters"),
  serverId: string().required("Server ID is required"),
  threadId: string().required("Thread ID is required"),
  channelId: string().required("Channel ID is required"),
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
    watch,
    setValue,
    formState: { errors, isSubmitting, isValid, isSubmitted },
  } = useForm<FormData>({
    resolver: yupResolver(formSchema),
    mode: "all",
  });
  const [serverId, channelId] = watch(["serverId", "channelId"]);
  const { mutateAsync, error } = useCreateDiscordChannelConnection();
  const initialFocusRef = useRef<any>(null);

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
      notifySuccess(
        "Succesfully added connection. New articles will be automatically delivered when found."
      );
      onClose();
    } catch (err) {}
  };

  useEffect(() => {
    reset();
  }, [isOpen]);

  const errorCount = Object.keys(errors).length;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      closeOnOverlayClick={!isSubmitting}
      initialFocusRef={initialFocusRef}
    >
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>
          {t("features.feed.components.addDiscordChannelThreadConnectionDialog.title")}
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Stack spacing={4}>
            <Text>Send articles authored by the bot as a message to an existing thread.</Text>
            <form id="addfeed" onSubmit={handleSubmit(onSubmit)}>
              <Stack spacing={4}>
                <FormControl isInvalid={!!errors.serverId} isRequired>
                  <FormLabel id="server-select-label" htmlFor="server-select">
                    {t(
                      "features.feed.components.addDiscordChannelConnectionDialog.formServerLabel"
                    )}
                  </FormLabel>
                  <Controller
                    name="serverId"
                    control={control}
                    render={({ field }) => (
                      <DiscordServerSearchSelectv2
                        {...field}
                        onChange={field.onChange}
                        value={field.value}
                        inputRef={initialFocusRef}
                        alertOnArticleEligibility
                        isInvalid={!!errors.serverId}
                        inputId="server-select"
                        ariaLabelledBy="server-select-label"
                      />
                    )}
                  />
                  <FormHelperText>
                    Only servers where you have server-wide Manage Channels permission will appear.
                    If you don&apos;t have this permission, you may ask someone who does to add the
                    feed and share it with you.
                  </FormHelperText>
                  <FormErrorMessage>{errors.serverId?.message}</FormErrorMessage>
                </FormControl>
                <FormControl isInvalid={!!errors.channelId} isRequired>
                  <FormLabel id="channel-select-label" htmlFor="channel-select">
                    {t(
                      "features.feed.components.addDiscordChannelConnectionDialog.formChannelLabel"
                    )}
                  </FormLabel>
                  <Controller
                    name="channelId"
                    control={control}
                    render={({ field }) => (
                      <DiscordChannelDropdown
                        isInvalid={!!errors.channelId}
                        value={field.value || ""}
                        onChange={(value) => {
                          field.onChange(value);
                        }}
                        include={[GetDiscordChannelType.Forum]}
                        onBlur={field.onBlur}
                        isDisabled={isSubmitting}
                        serverId={serverId}
                        inputId="channel-select"
                        ariaLabelledBy="channel-select-label"
                      />
                    )}
                  />
                  <FormErrorMessage>{errors.channelId?.message}</FormErrorMessage>
                </FormControl>
                <FormControl isInvalid={!!errors.threadId} isRequired>
                  <FormLabel id="forum-thread-label" htmlFor="forum-thread-select">
                    {t(
                      "features.feed.components.addDiscordChannelThreadConnectionDialog.formThreadLabel"
                    )}
                  </FormLabel>
                  <Controller
                    name="threadId"
                    control={control}
                    render={({ field }) => (
                      <DiscordActiveThreadDropdown
                        ariaLabelledBy="forum-thread-label"
                        isInvalid={!!errors.threadId}
                        inputId="forum-thread-select"
                        value={field.value || ""}
                        onChange={(value, name) => {
                          field.onChange(value);

                          if (name) {
                            setValue("name", name, {
                              shouldDirty: true,
                              shouldTouch: true,
                              shouldValidate: true,
                            });
                          }
                        }}
                        onBlur={field.onBlur}
                        isDisabled={isSubmitting}
                        serverId={serverId}
                        parentChannelId={channelId}
                      />
                    )}
                  />
                  <FormErrorMessage>{errors.threadId?.message}</FormErrorMessage>
                  <FormHelperText>
                    {t(
                      "features.feed.components" +
                        ".addDiscordChannelThreadConnectionDialog.formThreadDescripton"
                    )}
                  </FormHelperText>
                </FormControl>
                <FormControl isInvalid={!!errors.name} isRequired>
                  <FormLabel>
                    {t(
                      "features.feed.components.addDiscordChannelThreadConnectionDialog.formNameLabel"
                    )}
                  </FormLabel>
                  <Controller
                    name="name"
                    control={control}
                    render={({ field }) => (
                      <Input {...field} value={field.value || ""} bg="gray.800" />
                    )}
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
            {error && (
              <InlineErrorAlert
                title={t("common.errors.somethingWentWrong")}
                description={error.message}
              />
            )}
            {isSubmitted && errorCount > 0 && (
              <InlineErrorIncompleteFormAlert fieldCount={errorCount} />
            )}
          </Stack>
        </ModalBody>
        <ModalFooter>
          <HStack>
            <Button variant="ghost" mr={3} onClick={onClose} isDisabled={isSubmitting}>
              <span>{t("common.buttons.cancel")}</span>
            </Button>
            <Button
              colorScheme="blue"
              type="submit"
              form="addfeed"
              isLoading={isSubmitting}
              aria-disabled={isSubmitting || !isValid}
            >
              <span>{t("common.buttons.save")}</span>
            </Button>
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
