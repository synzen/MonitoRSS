import {
  Button,
  Flex,
  HStack,
  IconButton,
  Spinner,
  Stack,
  Text,
  useDisclosure,
} from "@chakra-ui/react";
import { FaGear, FaPlus } from "react-icons/fa6";
import { Avatar } from "@/components/ui/avatar";
import { LogicalFilterExpression } from "../../types";
import { useDiscordServerRoles } from "@/features/discordServers";
import { DiscordMentionSettingsDialog } from "./DiscordMentionSettingsDialog";
import { useDiscordUser } from "@/features/discordUser";
import MessagePlaceholderText from "../../../messageBuilder/components/MessagePlaceholderText";
import { InsertMentionDialog, SelectedMention } from "../../../messageBuilder/InsertMentionDialog";

export interface MentionsValue {
  targets?: Array<{
    type: "role" | "user";
    id: string;
    filters?: { expression: LogicalFilterExpression } | null;
  }> | null;
}

interface Props {
  guildId: string | undefined;
  value: MentionsValue | null | undefined;
  onChange: (value: MentionsValue) => void;
  excludeDescription?: boolean;
  smallButton?: boolean;
}

const MentionCheckbox = ({
  id,
  type,
  filters,
  onChangeFilters,
  onDelete,
  guildId,
  small,
}: {
  id: string;
  type: "role" | "user";
  filters: { expression: LogicalFilterExpression } | null;
  onChangeFilters: (filters: { expression: LogicalFilterExpression } | null) => void;
  onDelete: () => void;
  guildId?: string;
  small?: boolean;
}) => {
  const { getRolebyId, isFetching: isFetchingRoles } = useDiscordServerRoles({
    serverId: guildId,
    disabled: type !== "role",
  });
  const { data: userData, isFetching: isFetchingUser } = useDiscordUser({
    userId: id,
    disabled: type !== "user",
  });

  const role = getRolebyId(id);
  const roleName = role?.name || id;
  const userName = userData?.result.username || id;

  return (
    <HStack
      gap={2}
      alignItems="center"
      bg="bg.emphasized"
      color="fg"
      borderRadius="full"
      paddingLeft={2}
      paddingRight={1}
      height={small ? 8 : 9}
    >
      {type === "user" && userData?.result.avatarUrl && (
        <Avatar src={userData.result.avatarUrl} name={userData.result.username} size="2xs" />
      )}
      {type === "role" && <Avatar size="2xs" name={role?.name} background={role?.color} />}
      {type === "role" && isFetchingRoles && <Spinner size="xs" />}
      {type === "user" && isFetchingUser && <Spinner size="xs" />}
      {type === "role" && !isFetchingRoles && (
        <Text fontSize="sm" whiteSpace="nowrap">
          {roleName}
        </Text>
      )}
      {type === "user" && !isFetchingUser && (
        <Text fontSize="sm" whiteSpace="nowrap">
          {userName}
        </Text>
      )}
      <DiscordMentionSettingsDialog
        onRemoved={onDelete}
        onFiltersUpdated={async (newFilters) => {
          onChangeFilters(newFilters);
        }}
        filters={filters}
        trigger={
          <IconButton aria-label="Mention settings" size="2xs" variant="ghost">
            <FaGear fontSize="sm" />
          </IconButton>
        }
      />
    </HStack>
  );
};

export const DiscordMessageMentionForm = ({
  guildId,
  value,
  onChange,
  excludeDescription,
  smallButton,
}: Props) => {
  const { open, onOpen, onClose } = useDisclosure();

  const handleMentionSelected = (mention: SelectedMention) => {
    if (mention.type === "channel") return;

    onChange({
      ...value,
      targets: [
        ...(value?.targets || []),
        {
          id: mention.id,
          type: mention.type,
          filters: null,
        },
      ],
    });
  };

  return (
    <Stack gap={4}>
      {!excludeDescription && (
        <Text>
          Roles and users that will be mentioned in the
          <MessagePlaceholderText withBrackets>discord::mentions</MessagePlaceholderText>
          placeholder. Directly copy the placeholder paste it somewhere in your message format for
          it to show up.
        </Text>
      )}
      <Flex gap={4} flexWrap="wrap">
        {value?.targets?.map((target, currentIndex) => {
          if (!target) {
            return null;
          }

          return (
            <MentionCheckbox
              small={smallButton}
              key={target.id}
              filters={target.filters as any}
              id={target.id}
              type={target.type}
              guildId={guildId}
              onChangeFilters={(newFilters) => {
                const copyTargets = [...(value?.targets || [])];

                copyTargets[currentIndex] = {
                  ...target,
                  filters: newFilters,
                };

                onChange({
                  ...value,
                  targets: copyTargets,
                });
              }}
              onDelete={() => {
                const copyTargets = [...(value?.targets || [])];

                copyTargets.splice(currentIndex, 1);

                onChange({
                  ...value,
                  targets: copyTargets,
                });
              }}
            />
          );
        })}
        <Button
          onClick={onOpen}
          size={smallButton ? "sm" : undefined}
          variant="outline"
          colorPalette="brand"
        >
          <FaPlus fontSize="sm" />
          Add Mention
        </Button>
        {guildId && (
          <InsertMentionDialog
            isOpen={open}
            onClose={onClose}
            onSelected={handleMentionSelected}
            guildId={guildId}
            excludeChannels
          />
        )}
      </Flex>
    </Stack>
  );
};
