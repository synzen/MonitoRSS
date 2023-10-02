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
import { DiscordChannelDropdown, DiscordServerSearchSelectv2 } from "@/features/discordServers";

const formSchema = object({
  name: string().optional(),
  serverId: string().optional(),
  channelId: string().when("serverId", ([serverId], schema) => {
    if (serverId) {
      return schema.required();
    }

    return schema.optional();
  }),
});

type FormData = InferType<typeof formSchema>;

interface Props {
  onUpdate: (data: FormData) => Promise<void>;
  defaultValues: Required<FormData>;
  onClose: () => void;
  isOpen: boolean;
  onCloseRef: React.RefObject<HTMLButtonElement>;
}

export const EditConnectionChannelDialog: React.FC<Props> = ({
  onUpdate,
  defaultValues,
  onClose,
  isOpen,
  onCloseRef,
}) => {
  const { t } = useTranslation();
  const {
    handleSubmit,
    control,
    reset,
    formState: { isDirty, errors, isSubmitting },
    watch,
  } = useForm<FormData>({
    resolver: yupResolver(formSchema),
    mode: "all",
    defaultValues,
  });
  const serverId = watch("serverId");
  const initialRef = useRef<HTMLInputElement>(null);

  const onSubmit = async ({ channelId, name }: FormData) => {
    await onUpdate({ channelId, name });
    onClose();
    reset({ channelId, name });
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
          {t("features.feed.components.updateDiscordChannelConnectionDialog.title")}
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <form id="addfeed" onSubmit={handleSubmit(onSubmit)}>
            <Stack spacing={4}>
              <FormControl isInvalid={!!errors.name}>
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
              <FormControl isInvalid={!!errors.serverId}>
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
              </FormControl>
              <FormControl isInvalid={!!errors.channelId}>
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
                    />
                  )}
                />
                <FormErrorMessage>{errors.channelId?.message}</FormErrorMessage>
              </FormControl>
            </Stack>
          </form>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={onClose} isDisabled={isSubmitting}>
            {t("common.buttons.cancel")}
          </Button>
          <Button
            colorScheme="blue"
            type="submit"
            form="addfeed"
            isLoading={isSubmitting}
            isDisabled={!isDirty || isSubmitting}
          >
            {t("common.buttons.save")}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
