import { Code, Flex, HStack, IconButton, Spinner, Stack, Tag, Text } from "@chakra-ui/react";
import { Controller, useFormContext } from "react-hook-form";
import { Trans, useTranslation } from "react-i18next";
import { SettingsIcon } from "@chakra-ui/icons";
import { DiscordMessageFormData } from "@/types/discord";
import { useDiscordChannelConnection } from "../../hooks";
import { LogicalFilterExpression } from "../../types";
import { MentionSelectDialog } from "../MentionSelectDialog";
import { useDiscordServerRoles } from "../../../discordServers";
import { DiscordMentionSettingsDialog } from "./DiscordMentionSettingsDialog";

interface Props {
  feedId: string;
  connectionId: string;
}

const MentionCheckbox = ({
  id,
  type,
  filters,
  onChangeFilters,
  onDelete,
  feedId,
  guildId,
}: {
  id: string;
  type: "role" | "user";
  filters: { expression: LogicalFilterExpression } | null;
  onChangeFilters: (filters: { expression: LogicalFilterExpression } | null) => void;
  onDelete: () => void;
  feedId?: string;
  guildId?: string;
}) => {
  const { getRolebyId, isFetching: isFetchingRoles } = useDiscordServerRoles({
    serverId: guildId,
    disabled: type !== "role",
  });

  const roleName = getRolebyId(id)?.name || id;

  return (
    <Flex>
      <Tag key={id} variant="solid" size="lg" paddingRight={0}>
        <HStack width="100%">
          <Flex
            flex={1}
            justifyContent="center"
            alignItems="center"
            height="100%"
            padding="2px 4px"
          >
            {/* <Text>{type === "role" && !isFetchingRoles && roleName}</Text> */}
            {type === "role" && isFetchingRoles && <Spinner size="xs" />}
            {type === "role" && !isFetchingRoles && <Text height="100%">{roleName}</Text>}
          </Flex>
          <DiscordMentionSettingsDialog
            onRemoved={onDelete}
            feedId={feedId}
            onFiltersUpdated={async (newFilters) => {
              onChangeFilters(newFilters);
            }}
            filters={filters}
            trigger={
              <IconButton
                icon={<SettingsIcon fontSize="sm" />}
                aria-label="Mention settings"
                size="md"
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

export const DiscordMessageMentionForm = ({ feedId, connectionId }: Props) => {
  const { control } = useFormContext<DiscordMessageFormData>();
  const { connection } = useDiscordChannelConnection({
    feedId,
    connectionId,
  });
  const { t } = useTranslation();

  return (
    <Stack spacing={4}>
      <Text>
        <Trans
          i18nKey="components.discordMessageMentionForm.description"
          t={t}
          components={[<Code />]}
        />
      </Text>
      <Controller
        name="mentions"
        control={control}
        render={({ field }) => {
          return (
            <Flex gap={4} flexWrap="wrap">
              {field.value?.targets?.map((target, currentIndex) => {
                if (!target) {
                  return null;
                }

                return (
                  <MentionCheckbox
                    key={target.id}
                    filters={target.filters as any}
                    id={target.id}
                    type={target.type}
                    guildId={connection?.details.channel.guildId}
                    feedId={feedId}
                    onChangeFilters={(newFilters) => {
                      const copyTargets = [...(field.value?.targets || [])];

                      copyTargets[currentIndex] = {
                        ...target,
                        filters: newFilters,
                      };

                      field.onChange({
                        ...field.value,
                        targets: copyTargets,
                      });
                    }}
                    onDelete={() => {
                      const copyTargets = [...(field.value?.targets || [])];

                      copyTargets.splice(currentIndex, 1);

                      field.onChange({
                        ...field.value,
                        targets: copyTargets,
                      });
                    }}
                  />
                );
              })}
              <MentionSelectDialog
                guildId={connection?.details?.channel.guildId}
                onAdded={(added) => {
                  field.onChange({
                    ...field.value,
                    targets: [
                      ...(field.value?.targets || []),
                      {
                        id: added.id,
                        type: added.type,
                        filters: null,
                      },
                    ],
                  });
                }}
              />
            </Flex>
          );
        }}
      />
    </Stack>
  );
};
