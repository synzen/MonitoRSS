import { Box, Button, Flex, HStack, Stack, Text } from "@chakra-ui/react";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { PrimaryActionButton } from "@/components/PrimaryActionButton";

import { InlineErrorAlert, ThemedSelect } from "@/components";
import { useDebounce } from "@/hooks";
import { useDiscordUserMe } from "@/features/discordUser";
import {
  DiscordServerSearchSelectv2,
  useDiscordServerAccessStatus,
  useDiscordServerMembers,
} from "@/features/discordServers";
import { ConnectionsCheckboxList } from "../../ConnectionsCheckboxList";
import { useCreateUserFeedManagementInvite, useUserFeedContext } from "@/features/feed";
import { UserFeedManagerInviteType } from "@/constants";
import { usePageAlertContext } from "@/contexts/PageAlertContext";
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
import { Avatar } from "@/components/ui/avatar";
import { Tag } from "@/components/ui/tag";

interface OptionData {
  id: string;
  name: string;
  icon?: React.ReactElement | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const AddFeedComanagerDialog = ({ open, onOpenChange }: Props) => {
  const { t } = useTranslation();
  const { userFeed } = useUserFeedContext();
  const [currentInput, setCurrentInput] = useState("");
  const [guildId, setGuildId] = useState("");
  const [selectedMention, setSelectedMention] = useState<OptionData>();
  const setOpen = onOpenChange;
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
    disabled: !open || !debouncedSearch,
    data: {
      limit: 25,
      search: debouncedSearch,
    },
  });
  const {
    mutateAsync: createUserFeedManagementInvite,
    status: creatingInvitesStatus,
    error: createInviteError,
    reset: resetCreateInvite,
  } = useCreateUserFeedManagementInvite();
  const { createSuccessAlert } = usePageAlertContext();

  const submitIsDisabled =
    !selectedMention || !checkedConnections.length || creatingInvitesStatus === "loading";

  const onSelected = (data: { label: string; value: string; icon?: React.ReactElement | null }) => {
    setSelectedMention({
      id: data.value,
      name: data.label,
      icon: data.icon,
    });
  };

  const onClickSave = async () => {
    if (!selectedMention || submitIsDisabled) {
      return;
    }

    try {
      await createUserFeedManagementInvite({
        data: {
          feedId: userFeed.id,
          discordUserId: selectedMention.id,
          type: UserFeedManagerInviteType.CoManage,
          connections: checkedConnections.map((id) => ({
            connectionId: id,
          })),
        },
      });
      createSuccessAlert({
        title: `Successfully sent invite to ${selectedMention.name}`,
      });
      setOpen(false);
    } catch (err) {}
  };

  const onClickSelectAllConnections = () => {
    setCheckedConnections(userFeed.connections.map((c) => c.id) || []);
  };

  const onClickSelectNoneConnections = () => {
    setCheckedConnections([]);
  };

  useEffect(() => {
    setSelectedMention(undefined);
    setGuildId("");
    resetCreateInvite();
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
    <DialogRoot open={open} onOpenChange={(e) => setOpen(e.open)} size="lg">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite User to Co-manage Feed</DialogTitle>
        </DialogHeader>
        <DialogCloseTrigger />
        <DialogBody>
          <Stack gap={8}>
            <Text>
              This user will have access to manage the settings and the existing connections of this
              feed. You will retain ownership of this feed after they accept the invite. They must
              accept the invite by logging in.
            </Text>
            <Stack gap={6}>
              <Field
                invalid={!!isInvalidServer}
                required
                label={<span id="server-select-label">Discord Server</span>}
                errorText="The bot has no access to this server."
              >
                <DiscordServerSearchSelectv2
                  inputId="server-select"
                  onChange={(id) => setGuildId(id)}
                  value={guildId}
                  invalid={isInvalidServer || false}
                  placeholder="Search or select the server user's server"
                  ariaLabelledBy="server-select-label"
                />
              </Field>
              <Field required label={<span id="user-select-label">User</span>}>
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
              </Field>
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
              {usersError && (
                <InlineErrorAlert title="Failed to get users" description={usersError.message} />
              )}
              <fieldset>
                <Stack>
                  <Box>
                    <legend>
                      <Text as="span" fontWeight="medium">
                        Connections
                      </Text>
                    </legend>
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
                    feed={userFeed}
                  />
                </Stack>
              </fieldset>
            </Stack>
            {createInviteError?.message && (
              <InlineErrorAlert
                title={t("common.errors.somethingWentWrong")}
                description={createInviteError.message}
              />
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
              aria-disabled={submitIsDisabled}
              loading={creatingInvitesStatus === "loading"}
            >
              <span>Invite User to Co-manage</span>
            </PrimaryActionButton>
          </HStack>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
};
