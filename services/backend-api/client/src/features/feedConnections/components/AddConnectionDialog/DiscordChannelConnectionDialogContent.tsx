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
import {
  DiscordChannelDropdown,
  DiscordServerSearchSelectv2,
  GetDiscordChannelType,
} from "@/features/discordServers";
import RouteParams from "../../../../types/RouteParams";
import { useCreateDiscordChannelConnection } from "../../hooks";
import { notifySuccess } from "../../../../utils/notifySuccess";
import { InlineErrorAlert } from "../../../../components";

const formSchema = object({
  name: string().required("Name is required").max(250, "Name must be less than 250 characters"),
  channelId: string().required("Channel is required"),
  serverId: string().required("Server is required"),
});

interface Props {
  onClose: () => void;
  isOpen: boolean;
}

type FormData = InferType<typeof formSchema>;

export const DiscordChannelConnectionDialogContent: React.FC<Props> = ({ onClose, isOpen }) => {
  const { feedId } = useParams<RouteParams>();
  const { t } = useTranslation();
  const {
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting, isValid },
    watch,
    setValue,
  } = useForm<FormData>({
    resolver: yupResolver(formSchema),
    mode: "all",
  });
  const serverId = watch("serverId");
  const { mutateAsync, error } = useCreateDiscordChannelConnection();
  const initialFocusRef = useRef<any>(null);

  const onSubmit = async ({ channelId, name }: FormData) => {
    if (!feedId) {
      throw new Error("Feed ID missing while creating discord channel connection");
    }

    try {
      await mutateAsync({
        feedId,
        details: {
          name,
          channelId,
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
          {t("features.feed.components.addDiscordChannelConnectionDialog.title")}
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Stack spacing={4}>
            <Text>
              Send articles as messages authored by the bot to a Discord channel, or as a thread in
              a forum channel.
            </Text>
            <form id="addfeed" onSubmit={handleSubmit(onSubmit)}>
              <Stack spacing={4}>
                <FormControl isInvalid={!!errors.serverId} isRequired>
                  <FormLabel htmlFor="server-select" id="server-select">
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
                        ariaLabelledBy="server-select"
                        inputId="server-select"
                        alertOnArticleEligibility
                      />
                    )}
                  />
                  <FormHelperText>
                    Only servers where you have server-wide Manage Channels permission will appear.
                    If you don&apos;t have this permission, you may ask someone who does to add the
                    feed and share it with you.
                  </FormHelperText>
                </FormControl>
                <FormControl isInvalid={!!errors.channelId} isRequired>
                  <FormLabel>
                    {t(
                      "features.feed.components.addDiscordChannelConnectionDialog.formChannelLabel"
                    )}
                  </FormLabel>
                  <Controller
                    name="channelId"
                    control={control}
                    render={({ field }) => (
                      <DiscordChannelDropdown
                        value={field.value}
                        onChange={(value, name) => {
                          field.onChange(value);
                          setValue("name", name, {
                            shouldDirty: true,
                            shouldTouch: true,
                            shouldValidate: true,
                          });
                        }}
                        include={[GetDiscordChannelType.Forum]}
                        onBlur={field.onBlur}
                        isDisabled={isSubmitting}
                        serverId={serverId}
                      />
                    )}
                  />
                  <FormErrorMessage>{errors.channelId?.message}</FormErrorMessage>
                </FormControl>
                <FormControl isInvalid={!!errors.name} isRequired>
                  <FormLabel>
                    {t("features.feed.components.addDiscordChannelConnectionDialog.formNameLabel")}
                  </FormLabel>
                  <Controller
                    name="name"
                    control={control}
                    render={({ field }) => <Input {...field} bg="gray.800" />}
                  />
                  {errors.name && <FormErrorMessage>{errors.name.message}</FormErrorMessage>}
                  <FormHelperText>
                    {t(
                      "features.feed.components" +
                        ".addDiscordChannelConnectionDialog.formNameDescription"
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
              isDisabled={isSubmitting || !isValid}
            >
              <span>
                {t("features.feed.components.addDiscordChannelConnectionDialog.saveButton")}
              </span>
            </Button>
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
