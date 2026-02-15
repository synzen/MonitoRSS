/* eslint-disable react/destructuring-assignment */
/* eslint-disable react/jsx-props-no-spreading */
import {
  Button,
  Divider,
  FormControl,
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
import { useTranslation } from "react-i18next";
import { useForm, useFieldArray } from "react-hook-form";
import { useCallback, useEffect } from "react";
import { useDiscordUserMe } from "../../hooks";
import { updateDiscordMeSupporter } from "../../api";
import { notifySuccess } from "@/utils/notifySuccess";
import { useDiscordServers } from "@/features/discordServers";

interface FormValues {
  serverIds: string[];
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const UserSettingsDialog: React.FC<Props> = ({ isOpen, onClose }) => {
  const { data: userMe } = useDiscordUserMe();
  const { refetch: refetchServers } = useDiscordServers();
  const { register, control, handleSubmit, setValue, reset, formState } = useForm<FormValues>();
  const { fields } = useFieldArray({
    control,
    name: "serverIds" as never,
  });
  const { t } = useTranslation();

  const getDefaultFormValue: () => string[] = useCallback(() => {
    if (!userMe || !userMe.supporter) {
      return [];
    }

    const initArray = new Array(userMe.supporter.maxGuilds).fill("");

    for (let i = 0; i < userMe.supporter.guilds.length; i += 1) {
      initArray[i] = userMe.supporter.guilds[i];
    }

    return initArray;
  }, [userMe]);

  useEffect(() => {
    setValue("serverIds", getDefaultFormValue());
  }, [userMe, getDefaultFormValue]);

  const onSubmit = async (data: FormValues) => {
    const serverIds = data.serverIds.filter((id) => !!id);

    await updateDiscordMeSupporter({
      details: {
        guildIds: serverIds,
      },
    });

    // Get updated benefits of all servers
    await refetchServers();

    reset(data);
    notifySuccess(t("features.discordUsers.components.settingsDialog.serversUpdatedSuccess"));
    onClose();
  };

  const onReset = () => {
    reset({
      serverIds: getDefaultFormValue(),
    });
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>{t("features.discordUsers.components.settingsDialog.title")}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          {userMe && userMe.supporter && (
            <Stack spacing="4">
              <Text>{t("features.discordUsers.components.settingsDialog.description")}</Text>
              <form id="supporter-servers" onSubmit={handleSubmit(onSubmit)}>
                <Stack>
                  {fields.map((field, index) => (
                    <FormControl key={field.id}>
                      <Input
                        {...register(`serverIds.${index}`)}
                        placeholder={t(
                          "features.discordUsers.components.settingsDialog.serverInputPlaceholder",
                        )}
                      />
                    </FormControl>
                  ))}
                </Stack>
                <Divider />
              </form>
            </Stack>
          )}
        </ModalBody>
        <ModalFooter>
          <HStack>
            <Button onClick={onReset} variant="ghost" isDisabled={formState.isSubmitting}>
              <span>Cancel</span>
            </Button>
            <Button
              colorScheme="blue"
              form="supporter-servers"
              type="submit"
              isDisabled={!formState.isDirty || formState.isSubmitting}
              isLoading={formState.isSubmitting}
            >
              <span>Save</span>
            </Button>
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
