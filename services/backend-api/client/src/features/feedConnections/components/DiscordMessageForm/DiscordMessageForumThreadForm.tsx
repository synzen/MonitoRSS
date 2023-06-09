import {
  Box,
  Center,
  Checkbox,
  Flex,
  FormControl,
  FormErrorMessage,
  FormHelperText,
  FormLabel,
  HStack,
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
import { DiscordMessageFormData } from "@/types/discord";
import { useDiscordChannelConnection, useDiscordChannelForumTags } from "../../hooks";

interface Props {
  feedId: string;
  connectionId: string;
}

const TagCheckbox = ({
  emojiName,
  hasPermissionToUse,
  id,
  isChecked,
  name,
  onChange,
}: {
  id: string;
  isChecked: boolean;
  onChange: (e: boolean) => void;
  emojiName: string | null;
  name: string;
  hasPermissionToUse: boolean;
}) => {
  const { t } = useTranslation();

  return (
    <Tooltip
      isDisabled={hasPermissionToUse}
      label={t("components.discordMessageForumThreadForm.threadTagMissingPermissions")}
    >
      <Tag key={id} borderRadius="full" variant="solid" size="lg" paddingX="4" paddingY="2">
        <Checkbox
          value={id}
          isDisabled={!isChecked && !hasPermissionToUse}
          isChecked={isChecked}
          onChange={(e) => {
            onChange(e.target.checked);
          }}
        >
          <HStack>
            <Box>{emojiName}</Box>
            <Text>{name}</Text>
          </HStack>
        </Checkbox>
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
  const { status, data: availableTags } = useDiscordChannelForumTags({
    channelId: connection?.details.channel.id,
    serverId: connection?.details.channel.guildId,
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
              <Text>There are no tags in this channel.</Text>
            )}
            {status === "success" && availableTags && availableTags.length > 0 && (
              <Controller
                name="forumThreadTags"
                control={control}
                render={({ field }) => {
                  return (
                    <Flex gap={8} flexWrap="wrap">
                      {availableTags?.map(({ id, name, hasPermissionToUse, emojiName }) => (
                        <TagCheckbox
                          key={id}
                          emojiName={emojiName}
                          hasPermissionToUse={hasPermissionToUse}
                          id={id}
                          name={name}
                          isChecked={!!field.value?.find((v) => v.id === id)}
                          onChange={(isChecked) => {
                            if (isChecked) {
                              field.onChange(
                                [...(field.value || []), { id, name }].filter(
                                  (v) => !deletedTagIds.has(v.id)
                                )
                              );
                            } else {
                              field.onChange(
                                field.value
                                  ?.filter((v) => v.id !== id)
                                  .filter((v) => !deletedTagIds.has(v.id)) || []
                              );
                            }
                          }}
                        />
                      ))}
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
