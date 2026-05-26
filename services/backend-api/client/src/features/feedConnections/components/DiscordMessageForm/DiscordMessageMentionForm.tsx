import {
  Avatar,
  Button,
  Flex,
  HStack,
  IconButton,
  Spinner,
  Stack,
  Tag,
  Text,
  useDisclosure,
} from "@chakra-ui/react";
import { AddIcon, SettingsIcon } from "@chakra-ui/icons";
import { LogicalFilterExpression } from "../../types";
import { useDiscordServerRoles } from "../../../discordServers";
import { DiscordMentionSettingsDialog } from "./DiscordMentionSettingsDialog";
import { useDiscordUser } from "../../../discordUser";
import MessagePlaceholderText from "../../../../components/MessagePlaceholderText";
import {
  InsertMentionDialog,
  SelectedMention,
} from "../../../../pages/MessageBuilder/InsertMentionDialog";

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
    <Flex>
      <Tag key={id} variant="solid" size={small ? "md" : "lg"} paddingRight={0} bg="gray.700">
        {type === "user" && userData?.result.avatarUrl && (
          <Avatar
            src={userData.result.avatarUrl}
            name={userData.result.username}
            size="xs"
            marginRight={2}
          />
        )}
        {type === "role" && (
          <Avatar size="xs" marginRight={2} name={role?.name} background={role?.color} />
        )}
        <HStack width="100%">
          <Flex
            flex={1}
            justifyContent="center"
            alignItems="center"
            height="100%"
            padding="2px 4px"
          >
            {type === "role" && isFetchingRoles && <Spinner size="xs" />}
            {type === "user" && isFetchingUser && <Spinner size="xs" />}
            {type === "role" && !isFetchingRoles && <Text height="100%">{roleName}</Text>}
            {type === "user" && !isFetchingUser && <Text height="100%">{userName}</Text>}
          </Flex>
          <DiscordMentionSettingsDialog
            onRemoved={onDelete}
            onFiltersUpdated={async (newFilters) => {
              onChangeFilters(newFilters);
            }}
            filters={filters}
            trigger={
              <IconButton
                icon={<SettingsIcon fontSize="sm" />}
                aria-label="Mention settings"
                size={small ? "sm" : "md"}
                variant="ghost"
                borderLeftRadius={0}
              />
            }
          />
        </HStack>
      </Tag>
    </Flex>
  );
};

export const DiscordMessageMentionForm = ({
  guildId,
  value,
  onChange,
  excludeDescription,
  smallButton,
}: Props) => {
  const { isOpen, onOpen, onClose } = useDisclosure();

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
    <Stack spacing={4}>
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
          leftIcon={<AddIcon fontSize="sm" />}
          size={smallButton ? "sm" : undefined}
        >
          Add Mention
        </Button>
        {guildId && (
          <InsertMentionDialog
            isOpen={isOpen}
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
