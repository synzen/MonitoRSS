import {
  Box,
  Center,
  Field as ChakraField,
  Flex,
  HStack,
  IconButton,
  Input,
  Separator,
  Spinner,
  Stack,
  Tag as ChakraTag,
  Text,
} from "@chakra-ui/react";
import { Controller, useFormContext } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { FiFilter } from "react-icons/fi";
import { DiscordMessageFormData } from "@/types/discord";
import { useDiscordChannelForumTags } from "../../hooks";
import { DiscordForumTagFiltersDialog } from "./DiscordForumTagFiltersDialog";
import { LogicalFilterExpression } from "../../types";
import { useDiscordWebhook } from "@/features/discordWebhooks";
import { useUserFeedConnectionContext } from "@/features/feed";
import { FeedDiscordChannelConnection } from "@/types";
import MessagePlaceholderText from "../../../messageBuilder/components/MessagePlaceholderText";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip } from "@/components/ui/tooltip";

const TagCheckbox = ({
  emojiName,
  hasPermissionToUse,
  id,
  isChecked,
  filters,
  name,
  onChange,
}: {
  id: string;
  isChecked: boolean;
  filters: { expression: LogicalFilterExpression } | null;
  onChange: (e: boolean, filters: { expression: LogicalFilterExpression } | null) => void;
  emojiName: string | null;
  name?: string;
  hasPermissionToUse: boolean;
}) => {
  const { t } = useTranslation();

  return (
    <Tooltip
      disabled={hasPermissionToUse}
      content={t("components.discordMessageForumThreadForm.threadTagMissingPermissions")}
    >
      <ChakraTag.Root
        key={id}
        borderRadius="full"
        variant="solid"
        size="lg"
        paddingX="4"
        paddingY="2"
        bg="bg.emphasized"
      >
        <ChakraTag.Label asChild>
          <HStack gap={2}>
            <HStack gap={2} divideX="1px">
              <Checkbox
                value={id}
                disabled={!isChecked && !hasPermissionToUse}
                checked={isChecked}
                onCheckedChange={(e) => {
                  onChange(!!e.checked, filters);
                }}
              >
                <HStack>
                  <Box aria-hidden>{emojiName}</Box>
                  <Text>{name || "(no tag name)"}</Text>
                </HStack>
              </Checkbox>
              {isChecked && (
                <DiscordForumTagFiltersDialog
                  tagName={`${emojiName || ""} ${name || ""}`.trim()}
                  onFiltersUpdated={async (newFilters) => {
                    onChange(isChecked, newFilters);
                  }}
                  filters={filters}
                  trigger={
                    <IconButton
                      aria-label="Tag filters"
                      size="xs"
                      borderRadius="full"
                      variant="ghost"
                      disabled={!hasPermissionToUse || !isChecked}
                    >
                      <FiFilter />
                    </IconButton>
                  }
                />
              )}
            </HStack>
          </HStack>
        </ChakraTag.Label>
      </ChakraTag.Root>
    </Tooltip>
  );
};

export const DiscordMessageForumThreadForm = () => {
  const {
    control,
    formState: { errors },
  } = useFormContext<DiscordMessageFormData>();
  const { connection } = useUserFeedConnectionContext<FeedDiscordChannelConnection>();
  const guildId = connection.details.channel?.guildId || connection.details.webhook?.guildId;
  const channelId = connection.details.channel?.id;
  const webhookId = connection.details.webhook?.id;
  const { data: discordWebhookData } = useDiscordWebhook({
    webhookId,
  });
  const { status, data: availableTags } = useDiscordChannelForumTags({
    channelId: webhookId ? discordWebhookData?.result.channelId : channelId,
    serverId: guildId,
  });
  const { t } = useTranslation();
  const availableTagIds = new Set(availableTags?.map((tag) => tag.id));
  const deletedTagIds = new Set(
    connection.details.forumThreadTags?.filter((v) => !availableTagIds.has(v.id)).map((v) => v.id),
  );

  return (
    <Stack gap={8} separator={<Separator />}>
      <ChakraField.Root invalid={!!errors.forumThreadTitle}>
        <Stack
          direction={{ base: "column", md: "row" }}
          gap={{ base: "1.5", md: "8" }}
          justify="space-between"
        >
          <Box>
            <ChakraField.Label>
              {t("components.discordMessageForumThreadForm.threadTitleLabel")}
            </ChakraField.Label>
            <ChakraField.HelperText>
              The title of the thread that will be created per new article. You may use
              placeholders. The default is{" "}
              <MessagePlaceholderText withoutCopy>title</MessagePlaceholderText>.
            </ChakraField.HelperText>
          </Box>
          <Stack gap={8} width="100%" maxW={{ md: "3xl" }} minW={{ md: "md", lg: "lg", xl: "3xl" }}>
            <Controller
              name="forumThreadTitle"
              control={control}
              render={({ field }) => (
                <Input size="sm" aria-label="Forum thread title" spellCheck={false} {...field} />
              )}
            />
            {errors.forumThreadTitle && (
              <ChakraField.ErrorText>{errors.forumThreadTitle.message}</ChakraField.ErrorText>
            )}
          </Stack>
        </Stack>
      </ChakraField.Root>
      <Box>
        <Stack
          direction={{ base: "column", md: "row" }}
          gap={{ base: "1.5", md: "8" }}
          justify="space-between"
        >
          <Stack>
            <Text>{t("components.discordMessageForumThreadForm.threadTagsLabel")}</Text>
            <Text color="fg.muted" fontSize="sm">
              {t("components.discordMessageForumThreadForm.threadTagsDescription")}
            </Text>
          </Stack>
          <Stack gap={8} width="100%" maxW={{ md: "3xl" }} minW={{ md: "md", lg: "lg", xl: "3xl" }}>
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
                                (v) => v.id === id,
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
            {errors.content && (
              <ChakraField.ErrorText>{errors.content.message}</ChakraField.ErrorText>
            )}
          </Stack>
        </Stack>
      </Box>
    </Stack>
  );
};
