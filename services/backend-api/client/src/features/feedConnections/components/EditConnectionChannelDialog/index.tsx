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
import React, { useEffect, useRef, useState } from "react";
import {
  DiscordActiveThreadDropdown,
  DiscordChannelDropdown,
  DiscordServerSearchSelectv2,
  GetDiscordChannelType,
} from "@/features/discordServers";
import { notifySuccess } from "../../../../utils/notifySuccess";
import { InlineErrorAlert } from "../../../../components";

const formSchema = object({
  name: string().required("Connection name is required"),
  serverId: string().required("Server is required"),
  channelId: string().when("serverId", ([serverId], schema) => {
    if (serverId) {
      return schema.required("Channel is required");
    }

    return schema.optional();
  }),
  threadId: string(),
});

type FormData = InferType<typeof formSchema>;

interface Props {
  onUpdate: (data: FormData) => Promise<void>;
  defaultValues: FormData;
  onClose: () => void;
  isOpen: boolean;
  onCloseRef: React.RefObject<HTMLButtonElement>;
  type?: string | null;
}

export const EditConnectionChannelDialog: React.FC<Props> = ({
  onUpdate,
  defaultValues,
  onClose,
  isOpen,
  onCloseRef,
  type,
}) => {
  const { t } = useTranslation();
  const {
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
    watch,
  } = useForm<FormData>({
    resolver: yupResolver(formSchema),
    mode: "all",
    defaultValues,
  });
  const [serverId, channelId] = watch(["serverId", "channelId"]);
  const initialRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");

  const onSubmit = async ({
    channelId: inputChannelId,
    name,
    threadId,
    serverId: inputServerId,
  }: FormData) => {
    try {
      if (type === "thread" && threadId) {
        await onUpdate({ channelId: threadId, name, serverId: inputServerId });
      } else {
        await onUpdate({ channelId: inputChannelId, name, serverId: inputServerId });
      }

      onClose();
      reset({ channelId, name, threadId });
      notifySuccess(t("common.success.savedChanges"));
    } catch (err) {
      setError((err as Error).message);
    }
  };

  useEffect(() => {
    reset();
  }, [isOpen]);

  return (
    <Modal
      initialFocusRef={initialRef}
      finalFocusRef={onCloseRef}
      isOpen={isOpen}
      onClose={onClose}
    >
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>
          {type === "thread" && "Edit Discord Thread Connection"}
          {type === "forum" && "Edit Discord Forum Connection"}
          {!type && t("features.feed.components.updateDiscordChannelConnectionDialog.title")}
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <form id="addfeed" onSubmit={handleSubmit(onSubmit)}>
            <Stack spacing={4}>
              <FormControl isInvalid={!!errors.name} isRequired>
                <FormLabel>
                  {t("features.feed.components.addDiscordChannelConnectionDialog.formNameLabel")}
                </FormLabel>
                <Controller
                  name="name"
                  control={control}
                  render={({ field }) => <Input {...field} ref={initialRef} bg="gray.800" />}
                />
                {errors.name && <FormErrorMessage>{errors.name.message}</FormErrorMessage>}
                <FormHelperText>
                  {t(
                    "features.feed.components" +
                      ".addDiscordChannelConnectionDialog.formNameDescription"
                  )}
                </FormHelperText>
              </FormControl>
              <FormControl isInvalid={!!errors.serverId} isRequired>
                <FormLabel>
                  {t(
                    "features.feed.components" +
                      ".addDiscordChannelConnectionDialog.formServerLabel"
                  )}
                </FormLabel>
                <Controller
                  name="serverId"
                  control={control}
                  render={({ field }) => (
                    <DiscordServerSearchSelectv2
                      {...field}
                      onChange={(id) => field.onChange(id)}
                      value={field.value || ""}
                    />
                  )}
                />
                <FormHelperText>
                  Only servers where you have server-wide Manage Channels permission will appear. If
                  you don&apos;t have this permission, you may ask someone who does to add the feed
                  and share it with you.
                </FormHelperText>
              </FormControl>
              <FormControl isInvalid={!!errors.channelId} isRequired>
                <FormLabel>
                  {t(
                    "features.feed.components" +
                      ".addDiscordChannelConnectionDialog.formChannelLabel"
                  )}
                </FormLabel>
                <Controller
                  name="channelId"
                  control={control}
                  render={({ field }) => (
                    <DiscordChannelDropdown
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      isDisabled={isSubmitting}
                      serverId={serverId}
                      include={
                        type === "thread" || type === "forum"
                          ? [GetDiscordChannelType.Forum]
                          : undefined
                      }
                    />
                  )}
                />
                <FormErrorMessage>{errors.channelId?.message}</FormErrorMessage>
              </FormControl>
              {type === "thread" && (
                <FormControl isInvalid={!!errors.threadId} isRequired>
                  <FormLabel>
                    {t(
                      "features.feed.components.addDiscordChannelThreadConnectionDialog.formThreadLabel"
                    )}
                  </FormLabel>
                  <Controller
                    name="threadId"
                    control={control}
                    render={({ field }) => (
                      <DiscordActiveThreadDropdown
                        value={field.value || ""}
                        onChange={(value) => {
                          field.onChange(value);
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
              )}
              {error && (
                <InlineErrorAlert title={t("common.errors.failedToSave")} description={error} />
              )}
            </Stack>
          </form>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={onClose} isDisabled={isSubmitting}>
            <span>{t("common.buttons.cancel")}</span>
          </Button>
          <Button
            colorScheme="blue"
            type="submit"
            form="addfeed"
            isLoading={isSubmitting}
            isDisabled={isSubmitting}
          >
            <span>{t("common.buttons.save")}</span>
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
