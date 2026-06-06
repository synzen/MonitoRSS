import { Button, ButtonGroup, chakra, Flex, HStack, Icon, Stack, Text } from "@chakra-ui/react";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { FaPlus } from "react-icons/fa6";
import { PrimaryActionButton } from "@/components/PrimaryActionButton";
import { useDiscordServerMembers, useDiscordServerRoles } from "@/features/discordServers";
import { InlineErrorAlert, ThemedSelect } from "@/components";
import { useDebounce } from "@/hooks";
import {
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  DialogCloseTrigger,
} from "@/components/ui/dialog";
import { Tag } from "@/components/ui/tag";
import { Avatar } from "@/components/ui/avatar";

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
  const [open, setOpen] = useState(false);
  const {
    data: roles,
    error: rolesError,
    isFetching,
  } = useDiscordServerRoles({
    serverId: guildId,
    disabled: selectedType !== "role" || !open,
  });
  const debouncedSearch = useDebounce(currentInput, 500);
  const {
    data: users,
    error: usersError,
    isFetching: isFetchingUsers,
  } = useDiscordServerMembers({
    serverId: guildId,
    disabled: selectedType !== "user" || !open || !debouncedSearch,
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
      setOpen(false);
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
      <Button onClick={() => setOpen(true)} size={smallButton ? "sm" : undefined}>
        <Icon as={FaPlus} fontSize="sm" />
        {t("components.discordMessageMentionForm.addMentionButton")}
      </Button>
      <DialogRoot open={open} onOpenChange={(e) => setOpen(e.open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("components.discordMessageMentionForm.addMentionTitle")}</DialogTitle>
          </DialogHeader>
          <DialogCloseTrigger />
          <DialogBody>
            <Stack gap={8}>
              <Text>{t("components.discordMessageMentionForm.addMentionDescription")}</Text>
              <Stack gap={2}>
                <div>
                  {/* <FormLabel>Type</FormLabel> */}
                  <ButtonGroup width="100%" attached variant="outline">
                    <Button
                      onClick={onClickType("role")}
                      width="100%"
                      colorPalette={selectedType === "role" ? "brand" : undefined}
                      aria-label="Role type"
                    >
                      {t("components.discordMessageMentionForm.addRoleButton")}
                    </Button>
                    <Button
                      onClick={onClickType("user")}
                      width="100%"
                      colorPalette={selectedType === "user" ? "brand" : undefined}
                      aria-label="User type"
                    >
                      {t("components.discordMessageMentionForm.addUserButton")}
                    </Button>
                  </ButtonGroup>
                </div>
                <div>
                  <chakra.label srOnly htmlFor="mention-search" id="mention-label">
                    Select a {selectedType}
                  </chakra.label>
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
                </div>
                {selectedMention && (
                  <Flex justifyContent="center">
                    <Tag
                      size="lg"
                      startElement={
                        selectedMention.icon &&
                        React.cloneElement(selectedMention.icon, { size: "xs" })
                      }
                    >
                      {selectedMention.name}
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
          </DialogBody>
          <DialogFooter>
            <HStack>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                {t("common.buttons.cancel")}
              </Button>
              <PrimaryActionButton mr={3} onClick={onClickSave} disabled={!selectedMention}>
                {t("common.buttons.save")}
              </PrimaryActionButton>
            </HStack>
          </DialogFooter>
        </DialogContent>
      </DialogRoot>
    </>
  );
};
