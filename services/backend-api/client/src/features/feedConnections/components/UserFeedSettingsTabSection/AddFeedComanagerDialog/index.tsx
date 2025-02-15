import {
  Avatar,
  Box,
  Button,
  Flex,
  FormControl,
  FormErrorMessage,
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
import React, { cloneElement, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { InlineErrorAlert, ThemedSelect } from "@/components";
import { useDebounce } from "@/hooks";
import { useDiscordUserMe } from "../../../../discordUser";
import {
  DiscordServerSearchSelectv2,
  useDiscordServerAccessStatus,
  useDiscordServerMembers,
} from "../../../../discordServers";
import { ConnectionsCheckboxList } from "../../ConnectionsCheckboxList";
import { useUserFeed } from "../../../../feed/hooks";
import { UserFeed } from "../../../../feed/types";

interface OptionData {
  id: string;
  name: string;
  icon?: React.ReactElement | null;
}

interface Props {
  onAdded: (data: { id: string; connections: Array<{ connectionId: string }> }) => Promise<void>;
  trigger: React.ReactElement;
  description?: React.ReactNode;
  title?: React.ReactNode;
  okButtonText?: string;
  feedId?: string;
  error?: string;
  onClosed?: () => void;
}

export const AddFeedComanagerDialog = ({
  onAdded,
  trigger,
  title,
  description,
  okButtonText,
  feedId,
  error,
  onClosed,
}: Props) => {
  const { t } = useTranslation();
  const { feed } = useUserFeed({ feedId });
  const [currentInput, setCurrentInput] = useState("");
  const [guildId, setGuildId] = useState("");
  const [selectedMention, setSelectedMention] = useState<OptionData>();
  const { isOpen, onOpen, onClose } = useDisclosure({
    onClose: onClosed,
  });
  const { data: discordUserMe } = useDiscordUserMe();
  const [checkedConnections, setCheckedConnections] = useState<string[]>([]);
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
    if (!selectedMention) {
      return;
    }

    try {
      setSaving(true);
      await onAdded({
        id: selectedMention.id,
        connections: checkedConnections.map((id) => ({
          connectionId: id,
        })),
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const onClickSelectAllConnections = () => {
    setCheckedConnections(feed?.connections.map((c) => c.id) || []);
  };

  const onClickSelectNoneConnections = () => {
    setCheckedConnections([]);
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
      <Modal isOpen={isOpen} onClose={onClose} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>{title || "Select a User"}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Stack spacing={8}>
              {description}
              <Stack spacing={6}>
                <FormControl isInvalid={isInvalidServer} isRequired>
                  <FormLabel htmlFor="server-select" id="server-select-label">
                    Discord Server
                  </FormLabel>
                  <DiscordServerSearchSelectv2
                    inputId="server-select"
                    onChange={(id) => setGuildId(id)}
                    value={guildId}
                    isInvalid={isInvalidServer || false}
                    placeholder="Search or select the server user's server"
                    ariaLabelledBy="server-select-label"
                  />
                  {isInvalidServer && (
                    <FormErrorMessage>The bot has no access to this server.</FormErrorMessage>
                  )}
                </FormControl>
                <FormControl isRequired>
                  <FormLabel htmlFor="user-select" id="user-select-label">
                    User
                  </FormLabel>
                  <ThemedSelect
                    loading={isFetchingUsers}
                    onInputChange={(value) => setCurrentInput(value)}
                    options={options}
                    isInvalid={!!usersError}
                    onChange={(id, option) =>
                      onSelected({
                        value: id,
                        label: option.name,
                        icon: option.icon,
                      })
                    }
                    placeholder="Search for a user"
                    selectProps={{
                      filterOption: () => true,
                      inputId: "user-select",
                      "aria-labelledby": "user-select-label",
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
                <FormControl isRequired as="fieldset">
                  <Stack>
                    <Box>
                      <FormLabel as="legend">Connections</FormLabel>
                      <Text fontSize="sm">
                        The connections the invitee will be able to view and have access to for
                        management.
                      </Text>
                    </Box>
                    <HStack mt={1}>
                      <Button size="sm" onClick={onClickSelectAllConnections}>
                        Select all Connections
                      </Button>
                      <Button size="sm" onClick={onClickSelectNoneConnections}>
                        Unselect all Connections
                      </Button>
                    </HStack>
                    <ConnectionsCheckboxList
                      checkedConnectionIds={checkedConnections}
                      onCheckConnectionChange={setCheckedConnections}
                      feed={feed as UserFeed}
                    />
                  </Stack>
                </FormControl>
              </Stack>
              {error && (
                <InlineErrorAlert
                  title={t("common.errors.somethingWentWrong")}
                  description={error}
                />
              )}
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
                isDisabled={!selectedMention || !checkedConnections.length || saving}
                isLoading={saving}
              >
                <span>{okButtonText || t("common.buttons.save")}</span>
              </Button>
            </HStack>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};
