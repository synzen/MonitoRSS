import {
  Box,
  Button,
  ButtonGroup,
  FormControl,
  HStack,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Stack,
  Text,
  useDisclosure,
} from "@chakra-ui/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AddIcon } from "@chakra-ui/icons";
import { useDiscordServerRoles } from "../../../discordServers";
import { InlineErrorAlert, ThemedSelect } from "../../../../components";

interface Props {
  guildId?: string;
  onAdded: (data: { id: string; type: "user" | "role" }) => void;
}

export const MentionSelectDialog = ({ guildId, onAdded }: Props) => {
  const { t } = useTranslation();
  const [selectedType, setSelectedType] = useState<"user" | "role">("role");
  const [selectedMention, setSelectedMention] = useState<{
    id: string;
  }>();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const {
    data: roles,
    error: rolesError,
    isFetching,
  } = useDiscordServerRoles({
    serverId: guildId,
    disabled: selectedType !== "role" || !isOpen,
  });

  const onClickType = (type: "user" | "role") => () => {
    if (type === selectedType) {
      return;
    }

    setSelectedType(type);
    setSelectedMention(undefined);
  };

  const onSelected = (id: string) => {
    setSelectedMention({ id });
  };

  const onClickSave = () => {
    if (selectedMention) {
      onAdded({ id: selectedMention.id, type: selectedType });
      onClose();
    }
  };

  return (
    <>
      <Button onClick={onOpen} leftIcon={<AddIcon fontSize="small" />} variant="ghost">
        {t("components.discordMessageMentionForm.addMentionButton")}
      </Button>
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader> {t("components.discordMessageMentionForm.addMentionTitle")}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Stack spacing={8}>
              <Text>{t("components.discordMessageMentionForm.addMentionDescription")}</Text>
              <Stack spacing={2}>
                <FormControl>
                  {/* <FormLabel>Type</FormLabel> */}
                  <ButtonGroup width="100%" isAttached variant="outline">
                    <Button
                      onClick={onClickType("role")}
                      width="100%"
                      colorScheme={selectedType === "role" ? "blue" : undefined}
                      aria-label="Role type"
                    >
                      {t("components.discordMessageMentionForm.addRoleButton")}
                    </Button>
                    <Button
                      onClick={onClickType("user")}
                      width="100%"
                      colorScheme={selectedType === "user" ? "blue" : undefined}
                      aria-label="User type"
                      isDisabled
                    >
                      {t("components.discordMessageMentionForm.addUserButton")}
                    </Button>
                  </ButtonGroup>
                </FormControl>
                <FormControl>
                  {selectedType === "role" && (
                    <ThemedSelect
                      loading={isFetching}
                      value={selectedMention?.id || ""}
                      options={
                        roles?.results.map((r) => ({
                          data: r,
                          label: r.name,
                          value: r.id,
                          icon: (
                            <Box
                              borderRadius="full"
                              height="16px"
                              width="16px"
                              backgroundColor={r.color}
                            />
                          ),
                        })) || []
                      }
                      onChange={(roleId) => onSelected(roleId)}
                    />
                  )}
                </FormControl>
                {rolesError && (
                  <InlineErrorAlert title="Failed to get roles" description={rolesError.message} />
                )}
              </Stack>
            </Stack>
          </ModalBody>
          <ModalFooter>
            <HStack>
              <Button variant="ghost">{t("common.buttons.cancel")}</Button>
              <Button colorScheme="blue" mr={3} onClick={onClickSave} isDisabled={!selectedMention}>
                {t("common.buttons.save")}
              </Button>
            </HStack>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};
