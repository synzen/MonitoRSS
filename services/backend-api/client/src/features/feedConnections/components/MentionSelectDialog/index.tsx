import {
  Avatar,
  Button,
  ButtonGroup,
  Flex,
  FormControl,
  FormLabel,
  HStack,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Stack,
  Tag,
  TagLabel,
  Text,
  useDisclosure,
} from "@chakra-ui/react";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { AddIcon } from "@chakra-ui/icons";
import { useDiscordServerMembers, useDiscordServerRoles } from "../../../discordServers";
import { InlineErrorAlert, ThemedSelect } from "../../../../components";
import { useDebounce } from "../../../../hooks";

interface OptionData {
  id: string;
  name: string;
  icon?: React.ReactElement | null;
}

interface Props {
  guildId?: string;
  onAdded: (data: { id: string; type: "user" | "role" }) => void;
  smallButton?: boolean;
}

export const MentionSelectDialog = ({ guildId, onAdded, smallButton }: Props) => {
  const { t } = useTranslation();
  const [selectedType, setSelectedType] = useState<"user" | "role">("role");
  const [currentInput, setCurrentInput] = useState("");
  const [selectedMention, setSelectedMention] = useState<OptionData>();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const {
    data: roles,
    error: rolesError,
    isFetching,
  } = useDiscordServerRoles({
    serverId: guildId,
    disabled: selectedType !== "role" || !isOpen,
  });
  const debouncedSearch = useDebounce(currentInput, 500);
  const {
    data: users,
    error: usersError,
    isFetching: isFetchingUsers,
  } = useDiscordServerMembers({
    serverId: guildId,
    disabled: selectedType !== "user" || !isOpen || !debouncedSearch,
    data: {
      limit: 25,
      search: debouncedSearch,
    },
  });

  const onClickType = (type: "user" | "role") => () => {
    if (type === selectedType) {
      return;
    }

    setSelectedType(type);
    setSelectedMention(undefined);
  };

  const onSelected = (data: { label: string; value: string; icon?: React.ReactElement | null }) => {
    setSelectedMention({
      id: data.value,
      name: data.label,
      icon: data.icon,
    });
  };

  const onClickSave = () => {
    if (selectedMention) {
      onAdded({ id: selectedMention.id, type: selectedType });
      onClose();
    }
  };

  let options: Array<{
    label: string;
    value: string;
    icon?: React.ReactElement | null;
    data: OptionData;
  }> = [];

  if (selectedType === "role") {
    options =
      roles?.results.map((r) => ({
        data: {
          id: r.id,
          name: r.name || "",
          icon: <Avatar size="sm" name={r.name} backgroundColor={r.color} />,
        },
        label: r.name || "",
        value: r.id,
        icon: <Avatar size="sm" name={r.name} backgroundColor={r.color} />,
      })) || [];
  } else if (selectedType === "user") {
    options =
      users?.results.map((u) => {
        const icon = u.avatarUrl ? <Avatar name={u.username} size="sm" src={u.avatarUrl} /> : null;

        return {
          data: {
            id: u.id,
            name: u.username,
            icon,
          },
          label: u.username,
          value: u.id,
          icon,
        };
      }) || [];
  }

  return (
    <>
      <Button
        onClick={onOpen}
        leftIcon={<AddIcon fontSize="sm" />}
        size={smallButton ? "sm" : undefined}
      >
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
                    >
                      {t("components.discordMessageMentionForm.addUserButton")}
                    </Button>
                  </ButtonGroup>
                </FormControl>
                <FormControl>
                  <FormLabel htmlFor="mention-search" id="mention-label" srOnly>
                    Select a {selectedType}
                  </FormLabel>
                  <ThemedSelect
                    isInvalid={selectedType === "role" ? !!rolesError : !!usersError}
                    loading={isFetching || isFetchingUsers}
                    onInputChange={(value) => setCurrentInput(value)}
                    options={options}
                    onChange={(id, option) =>
                      onSelected({
                        value: id,
                        label: option.name,
                        icon: option.icon,
                      })
                    }
                    placeholder={
                      selectedType === "role"
                        ? t("components.discordMessageMentionForm.searchRolePlaceholder")
                        : t("components.discordMessageMentionForm.searchUserPlaceholder")
                    }
                    selectProps={{
                      filterOption: selectedType === "user" ? () => true : undefined,
                      "aria-labelledby": "mention-label",
                      inputId: "mention-search",
                    }}
                  />
                </FormControl>
                {selectedMention && (
                  <Flex justifyContent="center">
                    <Tag size="lg">
                      {selectedMention.icon &&
                        React.cloneElement(selectedMention.icon, { size: "xs" })}
                      <TagLabel ml={2}>{selectedMention.name}</TagLabel>
                    </Tag>
                  </Flex>
                )}
                {selectedType === "role" && rolesError && (
                  <InlineErrorAlert title="Failed to get roles" description={rolesError.message} />
                )}
                {selectedType === "user" && usersError && (
                  <InlineErrorAlert title="Failed to get users" description={usersError.message} />
                )}
              </Stack>
            </Stack>
          </ModalBody>
          <ModalFooter>
            <HStack>
              <Button variant="ghost" onClick={onClose}>
                {t("common.buttons.cancel")}
              </Button>
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
