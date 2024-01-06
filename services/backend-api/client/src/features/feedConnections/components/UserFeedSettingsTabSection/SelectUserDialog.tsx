import {
  Avatar,
  Button,
  Flex,
  FormControl,
  FormErrorMessage,
  FormHelperText,
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
  useDisclosure,
} from "@chakra-ui/react";
import React, { cloneElement, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  DiscordServerSearchSelectv2,
  useDiscordServerAccessStatus,
  useDiscordServerMembers,
} from "../../../discordServers";
import { InlineErrorAlert, ThemedSelect } from "../../../../components";
import { useDebounce } from "../../../../hooks";
import { useDiscordUserMe } from "../../../discordUser";

interface OptionData {
  id: string;
  name: string;
  icon?: React.ReactElement | null;
}

interface Props {
  onAdded: (data: { id: string }) => Promise<void>;
  trigger: React.ReactElement;
  description?: React.ReactNode;
  title?: React.ReactNode;
  okButtonText?: string;
}

export const SelectUserDialog = ({ onAdded, trigger, title, description, okButtonText }: Props) => {
  const { t } = useTranslation();
  const [currentInput, setCurrentInput] = useState("");
  const [guildId, setGuildId] = useState("");
  const [selectedMention, setSelectedMention] = useState<OptionData>();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { data: discordUserMe } = useDiscordUserMe();
  const debouncedSearch = useDebounce(currentInput, 500);
  const { data: serverAccessData } = useDiscordServerAccessStatus({ serverId: guildId });
  const {
    data: users,
    error: usersError,
    isFetching: isFetchingUsers,
  } = useDiscordServerMembers({
    serverId: guildId,
    disabled: !isOpen || !debouncedSearch,
    data: {
      limit: 25,
      search: debouncedSearch,
    },
  });
  const [saving, setSaving] = useState(false);

  const onSelected = (data: { label: string; value: string; icon?: React.ReactElement | null }) => {
    setSelectedMention({
      id: data.value,
      name: data.label,
      icon: data.icon,
    });
  };

  const onClickSave = async () => {
    if (selectedMention) {
      try {
        setSaving(true);
        await onAdded({ id: selectedMention.id });
      } finally {
        setSaving(false);
      }

      onClose();
    }
  };

  useEffect(() => {
    setSelectedMention(undefined);
    setGuildId("");
  }, [isOpen]);

  const options: Array<{
    label: string;
    value: string;
    icon?: React.ReactElement | null;
    data: OptionData;
  }> =
    users?.results
      .filter((u) => (discordUserMe ? u.id !== discordUserMe.id : true))
      .map((u) => {
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

  const isInvalidServer = serverAccessData && !serverAccessData.result.authorized;

  return (
    <>
      {cloneElement(trigger, { onClick: onOpen })}
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>{title || "Select a User"}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Stack spacing={8}>
              {description}
              <Stack spacing={4}>
                <FormControl isInvalid={isInvalidServer}>
                  <FormLabel>Discord Server</FormLabel>
                  <DiscordServerSearchSelectv2 onChange={(id) => setGuildId(id)} value={guildId} />
                  {!isInvalidServer && (
                    <FormHelperText>This is to help narrow down where the user is.</FormHelperText>
                  )}
                  {isInvalidServer && (
                    <FormErrorMessage>The bot has no access to this server.</FormErrorMessage>
                  )}
                </FormControl>
                <FormControl>
                  <FormLabel>User</FormLabel>
                  <ThemedSelect
                    loading={isFetchingUsers}
                    onInputChange={(value) => setCurrentInput(value)}
                    options={options}
                    onChange={(id, option) =>
                      onSelected({
                        value: id,
                        label: option.name,
                        icon: option.icon,
                      })
                    }
                    placeholder="Search for a user..."
                    selectProps={{
                      filterOption: () => true,
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
                {usersError && (
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
              <Button
                colorScheme="blue"
                mr={3}
                onClick={onClickSave}
                isDisabled={!selectedMention || saving}
                isLoading={saving}
              >
                {okButtonText || t("common.buttons.save")}
              </Button>
            </HStack>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};
