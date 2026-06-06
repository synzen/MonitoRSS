import { Button, Flex, HStack, Stack } from "@chakra-ui/react";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { PrimaryActionButton } from "@/components/PrimaryActionButton";
import {
  DiscordServerSearchSelectv2,
  useDiscordServerAccessStatus,
  useDiscordServerMembers,
} from "@/features/discordServers";
import { InlineErrorAlert, ThemedSelect } from "@/components";
import { useDebounce } from "@/hooks";
import { useDiscordUserMe } from "@/features/discordUser";
import {
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
  DialogCloseTrigger,
} from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Tag } from "@/components/ui/tag";
import { Avatar } from "@/components/ui/avatar";

interface OptionData {
  id: string;
  name: string;
  icon?: React.ReactElement | null;
}

interface Props {
  onAdded: (data: { id: string }) => Promise<void>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  description?: React.ReactNode;
  title?: React.ReactNode;
  okButtonText?: string;
  onClosed?: () => void;
  error?: string;
}

export const SelectUserDialog = ({
  onAdded,
  open,
  onOpenChange,
  title,
  description,
  okButtonText,
  onClosed,
  error,
}: Props) => {
  const { t } = useTranslation();
  const setOpen = onOpenChange;

  const [currentInput, setCurrentInput] = useState("");
  const [guildId, setGuildId] = useState("");
  const [selectedMention, setSelectedMention] = useState<OptionData>();
  const { data: discordUserMe } = useDiscordUserMe();
  const debouncedSearch = useDebounce(currentInput, 500);
  const { data: serverAccessData } = useDiscordServerAccessStatus({ serverId: guildId });
  const {
    data: users,
    error: usersError,
    isFetching: isFetchingUsers,
  } = useDiscordServerMembers({
    serverId: guildId,
    disabled: !open || !debouncedSearch,
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

      setOpen(false);
    }
  };

  useEffect(() => {
    setSelectedMention(undefined);
    setGuildId("");
  }, [open]);

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
    <DialogRoot
      open={open}
      onOpenChange={(e) => {
        setOpen(e.open);

        if (!e.open) {
          onClosed?.();
        }
      }}
    >
      <DialogContent>
        <DialogHeader marginRight={4}>
          <DialogTitle>{title || "Select a User"}</DialogTitle>
        </DialogHeader>
        <DialogCloseTrigger />
        <DialogBody>
          <Stack gap={8}>
            {description}
            <Stack gap={4}>
              <Field
                label="Discord Server"
                invalid={isInvalidServer || false}
                required
                errorText="The bot has no access to this server."
              >
                <DiscordServerSearchSelectv2
                  onChange={(id) => setGuildId(id)}
                  value={guildId}
                  inputId="server-select"
                  placeholder="Search for select the user's server"
                  invalid={isInvalidServer || false}
                  ariaLabelledBy="server-select-id"
                />
              </Field>
              <Field label="User" required>
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
                  }}
                />
              </Field>
              {selectedMention && (
                <Flex justifyContent="center">
                  <Tag
                    size="lg"
                    startElement={
                      selectedMention.icon
                        ? React.cloneElement(selectedMention.icon, {
                            size: "xs",
                            "aria-hidden": true,
                          })
                        : undefined
                    }
                  >
                    {selectedMention.name}
                  </Tag>
                </Flex>
              )}
              {usersError && (
                <InlineErrorAlert title="Failed to get users" description={usersError.message} />
              )}
            </Stack>
            {error && (
              <InlineErrorAlert title={t("common.errors.somethingWentWrong")} description={error} />
            )}
          </Stack>
        </DialogBody>
        <DialogFooter>
          <HStack>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {t("common.buttons.cancel")}
            </Button>
            <PrimaryActionButton
              mr={3}
              onClick={onClickSave}
              disabled={!selectedMention}
              loading={saving}
            >
              <span>{okButtonText || t("common.buttons.save")}</span>
            </PrimaryActionButton>
          </HStack>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
};
