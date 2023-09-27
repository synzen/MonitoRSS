import {
  Box,
  Center,
  Checkbox,
  Divider,
  Flex,
  FormControl,
  FormErrorMessage,
  FormHelperText,
  FormLabel,
  HStack,
  IconButton,
  Input,
  Spinner,
  Stack,
  StackDivider,
  Tag,
  Text,
  Tooltip,
} from "@chakra-ui/react";
import { Controller, useFormContext } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { FiFilter } from "react-icons/fi";
import { DiscordMessageFormData } from "@/types/discord";
import { useDiscordChannelConnection, useDiscordChannelForumTags } from "../../hooks";
import { DiscordForumTagFiltersDialog } from "./DiscordForumTagFiltersDialog";
import { LogicalFilterExpression } from "../../types";
import { useDiscordWebhook } from "../../../discordWebhooks";

interface Props {
  feedId: string;
  connectionId: string;
}

const TagCheckbox = ({
  emojiName,
  hasPermissionToUse,
  id,
  isChecked,
  filters,
  name,
  onChange,
  feedId,
}: {
  id: string;
  isChecked: boolean;
  filters: { expression: LogicalFilterExpression } | null;
  onChange: (e: boolean, filters: { expression: LogicalFilterExpression } | null) => void;
  emojiName: string | null;
  name?: string;
  hasPermissionToUse: boolean;
  feedId: string;
}) => {
  const { t } = useTranslation();

  return (
    <Tooltip
      isDisabled={hasPermissionToUse}
      label={t("components.discordMessageForumThreadForm.threadTagMissingPermissions")}
    >
      <Tag key={id} borderRadius="full" variant="solid" size="lg" paddingX="4" paddingY="2">
        <HStack divider={<Divider orientation="vertical" height="5" />}>
          <Checkbox
            value={id}
            isDisabled={!isChecked && !hasPermissionToUse}
            isChecked={isChecked}
            onChange={(e) => {
              onChange(e.target.checked, filters);
            }}
          >
            <HStack>
              <Box>{emojiName}</Box>
              <Text>{name || "(no name)"}</Text>
            </HStack>
          </Checkbox>
          {isChecked && (
            <DiscordForumTagFiltersDialog
              tagName={`${emojiName || ""} ${name || ""}`.trim()}
              feedId={feedId}
              onFiltersUpdated={async (newFilters) => {
                onChange(isChecked, newFilters);
              }}
              filters={filters}
              trigger={
                <IconButton
                  icon={<FiFilter />}
                  aria-label="Tag filters"
                  size="xs"
                  borderRadius="full"
                  variant="ghost"
                  isDisabled={!hasPermissionToUse || !isChecked}
                />
              }
            />
          )}
        </HStack>
      </Tag>
    </Tooltip>
  );
};

export const DiscordMessageForumThreadForm = ({ feedId, connectionId }: Props) => {
  const {
    control,
    formState: { errors },
  } = useFormContext<DiscordMessageFormData>();
  const { connection } = useDiscordChannelConnection({
    feedId,
    connectionId,
  });
  const guildId = connection?.details?.channel?.guildId || connection?.details.webhook?.guildId;
  const channelId = connection?.details?.channel?.id;
  const webhookId = connection?.details?.webhook?.id;
  const { data: discordWebhookData } = useDiscordWebhook({
    webhookId,
  });
  const { status, data: availableTags } = useDiscordChannelForumTags({
    channelId: webhookId ? discordWebhookData?.result.id : channelId,
    serverId: guildId,
  });
  const { t } = useTranslation();
  const availableTagIds = new Set(availableTags?.map((tag) => tag.id));
  const deletedTagIds = new Set(
    connection?.details?.forumThreadTags?.filter((v) => !availableTagIds.has(v.id)).map((v) => v.id)
  );

  return (
    <Stack spacing={8} divider={<StackDivider />}>
      <FormControl isInvalid={!!errors.content}>
        <Stack
          direction={{ base: "column", md: "row" }}
          spacing={{ base: "1.5", md: "8" }}
          justify="space-between"
        >
          <Box>
            <FormLabel>{t("components.discordMessageForumThreadForm.threadTitleLabel")}</FormLabel>
            <FormHelperText>
              {t("components.discordMessageForumThreadForm.threadTitleDescription")}
            </FormHelperText>
          </Box>
          <Stack spacing={8} width="100%" maxW={{ md: "3xl" }} minW={{ md: "3xl" }}>
            <Controller
              name="forumThreadTitle"
              control={control}
              render={({ field }) => (
                <Input size="sm" aria-label="Forum thread title" spellCheck={false} {...field} />
              )}
            />
            {errors.content && <FormErrorMessage>{errors.content.message}</FormErrorMessage>}
          </Stack>
        </Stack>
      </FormControl>
      <FormControl isInvalid={!!errors.forumThreadTags}>
        <Stack
          direction={{ base: "column", md: "row" }}
          spacing={{ base: "1.5", md: "8" }}
          justify="space-between"
        >
          <Box>
            <FormLabel>{t("components.discordMessageForumThreadForm.threadTagsLabel")}</FormLabel>
            <FormHelperText>
              {t("components.discordMessageForumThreadForm.threadTagsDescription")}
            </FormHelperText>
          </Box>
          <Stack spacing={8} width="100%" maxW={{ md: "3xl" }} minW={{ md: "3xl" }}>
            {status === "loading" && (
              <Center height="100%">
                <Spinner />
              </Center>
            )}
            {status === "success" && !availableTags?.length && (
              <Text>{t("components.discordMessageForumThreadForm.threadTagsNoTagsFound")}</Text>
            )}
            {status === "success" && availableTags && availableTags.length > 0 && (
              <Controller
                name="forumThreadTags"
                control={control}
                render={({ field }) => {
                  return (
                    <Flex gap={4} flexWrap="wrap">
                      {availableTags?.map(({ id, name, hasPermissionToUse, emojiName }) => {
                        const filters =
                          (field.value?.find((v) => v.id === id)?.filters as {
                            expression: LogicalFilterExpression;
                          } | null) || null;

                        return (
                          <TagCheckbox
                            key={id}
                            feedId={feedId}
                            filters={filters || null}
                            emojiName={emojiName}
                            hasPermissionToUse={hasPermissionToUse}
                            id={id}
                            name={name}
                            isChecked={!!field.value?.find((v) => v.id === id)}
                            onChange={(isChecked, newFilters) => {
                              const useNewFilters =
                                Object.keys(newFilters?.expression || {}).length > 0
                                  ? newFilters
                                  : null;

                              const fieldsWithoutDeletedTags =
                                field.value?.filter((v) => !deletedTagIds.has(v.id)) || [];

                              if (!isChecked) {
                                const newVal = fieldsWithoutDeletedTags.filter((v) => v.id !== id);

                                field.onChange(newVal);

                                return;
                              }

                              const existingFieldIndex = fieldsWithoutDeletedTags.findIndex(
                                (v) => v.id === id
                              );

                              if (existingFieldIndex === -1) {
                                const newVal = fieldsWithoutDeletedTags.concat([
                                  { id, filters: useNewFilters },
                                ]);

                                field.onChange(newVal);

                                return;
                              }

                              const newVal = [...fieldsWithoutDeletedTags];

                              newVal.splice(existingFieldIndex, 1, {
                                id,
                                filters: useNewFilters,
                              });

                              field.onChange(newVal);
                            }}
                          />
                        );
                      })}
                    </Flex>
                  );
                }}
              />
            )}
            {errors.content && <FormErrorMessage>{errors.content.message}</FormErrorMessage>}
          </Stack>
        </Stack>
      </FormControl>
    </Stack>
  );
};
