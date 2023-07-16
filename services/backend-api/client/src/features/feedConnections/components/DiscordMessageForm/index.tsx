import { AddIcon } from "@chakra-ui/icons";
import {
  Button,
  Flex,
  Heading,
  Highlight,
  HStack,
  IconButton,
  Stack,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
} from "@chakra-ui/react";
import { yupResolver } from "@hookform/resolvers/yup";
import { useState } from "react";
import { FormProvider, useFieldArray, useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import {
  DiscordMessageEmbedFormData,
  DiscordMessageFormData,
  discordMessageFormSchema,
} from "@/types/discord";
import { DiscordMessageContentForm } from "./DiscordMessageContentForm";
import { DiscordMessageEmbedForm } from "./DiscordMessageEmbedForm";
import { notifyError } from "../../../../utils/notifyError";
import { FeedConnectionType } from "../../../../types";
import { DiscordChannelConnectionPreview } from "./DiscordChannelConnectionPreview";
import { DiscordWebhookConnectionPreview } from "./DiscordWebhookConnectionPreview";
import { DiscordMessageForumThreadForm } from "./DiscordMessageForumThreadForm";
import { DiscordMessageMentionForm } from "./DiscordMessageMentionForm";
import { DiscordMessagePlaceholderLimitsForm } from "./DiscordMessagePlaceholderLimitsForm";

interface Props {
  defaultValues?: DiscordMessageFormData;
  onClickSave: (data: DiscordMessageFormData) => Promise<void>;
  articleIdToPreview?: string;
  feedId: string;
  guildId: string | undefined;
  connection: {
    id: string;
    type: FeedConnectionType;
  };
  include?: {
    forumThreadTitle?: boolean;
  };
}

const templateEmbed: DiscordMessageEmbedFormData = Object.freeze({});

export const DiscordMessageForm = ({
  defaultValues,
  onClickSave,
  articleIdToPreview,
  connection,
  feedId,
  guildId,
  include,
}: Props) => {
  const defaultIndex = defaultValues?.embeds?.length ? defaultValues.embeds.length - 1 : 0;

  const { t } = useTranslation();
  const [activeEmbedIndex, setActiveEmbedIndex] = useState(defaultIndex);

  const formMethods = useForm<DiscordMessageFormData>({
    resolver: yupResolver(discordMessageFormSchema),
    defaultValues,
    mode: "all",
  });
  const {
    handleSubmit,
    control,
    reset,
    formState: { isDirty, isSubmitting, errors },
  } = formMethods;
  const {
    fields: embeds,
    append,
    remove,
  } = useFieldArray({
    control,
    name: "embeds",
  });
  const [splitOptions, content, formatOptions, watchedEmbeds, watchedMentions, placeholderLimits] =
    useWatch({
      control,
      name: ["splitOptions", "content", "formatter", "embeds", "mentions", "placeholderLimits"],
    });

  const onSubmit = async (formData: DiscordMessageFormData) => {
    try {
      const embedsWithoutEmptyObjects = formData.embeds?.map((embed) => {
        const newEmbed = { ...embed };

        if (!newEmbed.author?.name) {
          newEmbed.author = null;
        }

        if (!newEmbed.footer?.text) {
          newEmbed.footer = null;
        }

        if (!newEmbed.thumbnail?.url) {
          newEmbed.thumbnail = null;
        }

        if (!newEmbed.image?.url) {
          newEmbed.image = null;
        }

        return newEmbed;
      });

      const toSubmit: DiscordMessageFormData = {
        content: formData.content?.trim(),
        embeds: embedsWithoutEmptyObjects,
        splitOptions: formData.splitOptions || null,
        formatter: formData.formatter,
        forumThreadTitle: formData.forumThreadTitle,
        forumThreadTags: formData.forumThreadTags || [],
        mentions: formData.mentions,
        placeholderLimits: formData.placeholderLimits,
      };

      await onClickSave(toSubmit);
      reset(toSubmit);
    } catch (err) {
      notifyError(t("common.errors.failedToSave"), err as Error);
    }
  };

  const onAddEmbed = () => {
    append(templateEmbed as never);
    setActiveEmbedIndex(embeds.length);
  };

  const onRemoveEmbed = (index: number) => {
    remove(index);
    const newIndex = Math.max(index - 1, 0);
    setActiveEmbedIndex(newIndex);
  };

  const onEmbedTabChanged = (index: number) => {
    setActiveEmbedIndex(index);
  };

  const errorsExist = Object.keys(errors).length > 0;

  return (
    <FormProvider {...formMethods}>
      <form onSubmit={handleSubmit(onSubmit)}>
        <Stack spacing={24}>
          <Stack spacing={4}>
            <Stack spacing={4}>
              <HStack spacing={4} alignItems="center">
                <Heading as="h2" size="md">
                  {t("components.discordMessageForm.previewSectionTitle")}
                </Heading>
                {isDirty && (
                  <Text fontSize="sm" fontWeight={600}>
                    <Highlight
                      query={t("components.discordMessageForm.previewSectionUnsavedWarning")}
                      styles={{
                        bg: "orange.200",
                        rounded: "full",
                        px: "2",
                        py: "1",
                      }}
                    >
                      {t("components.discordMessageForm.previewSectionUnsavedWarning")}
                    </Highlight>
                  </Text>
                )}
              </HStack>
              <Text>{t("components.discordMessageForm.previewSectionDescription")}</Text>
            </Stack>
            {connection.type === FeedConnectionType.DiscordChannel && (
              <DiscordChannelConnectionPreview
                connectionId={connection.id}
                data={{
                  article: articleIdToPreview
                    ? {
                        id: articleIdToPreview,
                      }
                    : undefined,
                  embeds: watchedEmbeds,
                  content,
                  splitOptions,
                  connectionFormatOptions: formatOptions,
                  mentions: watchedMentions,
                  placeholderLimits,
                }}
                feedId={feedId}
              />
            )}
            {connection.type === FeedConnectionType.DiscordWebhook && (
              <DiscordWebhookConnectionPreview
                connectionId={connection.id}
                data={{
                  article: articleIdToPreview
                    ? {
                        id: articleIdToPreview,
                      }
                    : undefined,
                  embeds: watchedEmbeds,
                  content,
                  splitOptions,
                  connectionFormatOptions: formatOptions,
                  placeholderLimits,
                }}
                feedId={feedId}
              />
            )}
          </Stack>
          {include?.forumThreadTitle && (
            <Stack spacing={4}>
              <Heading size="md">{t("components.discordMessageForumThreadForm.title")}</Heading>
              <DiscordMessageForumThreadForm connectionId={connection.id} feedId={feedId} />
            </Stack>
          )}
          <Stack spacing={4}>
            <Heading size="md">{t("components.discordMessageForm.textSectionTitle")}</Heading>
            <DiscordMessageContentForm />
          </Stack>
          <Stack spacing={4}>
            <Heading size="md">{t("components.discordMessageForm.embedSectionTitle")}</Heading>
            <Text>{t("components.discordMessageForm.embedSectionDescription")}</Text>
            <Tabs variant="solid-rounded" index={activeEmbedIndex} onChange={onEmbedTabChanged}>
              <HStack overflow="auto">
                <TabList>
                  {embeds?.map((embed, index) => (
                    <Tab key={embed.id}>Embed {index + 1}</Tab>
                  ))}
                </TabList>
                {(embeds?.length ?? 0) < 10 && (
                  <IconButton
                    onClick={onAddEmbed}
                    variant="ghost"
                    aria-label="Add new embed"
                    icon={<AddIcon />}
                  />
                )}
              </HStack>
              <TabPanels>
                {embeds?.map((embed, index) => (
                  <TabPanel key={embed.id}>
                    <Stack spacing={8}>
                      <Flex justifyContent="flex-end">
                        <Button
                          colorScheme="red"
                          size="sm"
                          variant="outline"
                          onClick={() => onRemoveEmbed(index)}
                        >
                          {t("features.feedConnections.components.embedForm.deleteButtonText")}
                        </Button>
                      </Flex>
                      <DiscordMessageEmbedForm index={index} />
                    </Stack>
                  </TabPanel>
                ))}
              </TabPanels>
            </Tabs>
          </Stack>
          <Stack spacing={4}>
            <Heading size="md">{t("components.discordMessageMentionForm.title")}</Heading>
            <DiscordMessageMentionForm guildId={guildId} feedId={feedId} />
          </Stack>
          <Stack spacing={4}>
            <Heading size="md">Placeholder Limits</Heading>
            <DiscordMessagePlaceholderLimitsForm guildId={guildId} feedId={feedId} />
          </Stack>
          <Flex direction="row-reverse">
            <HStack>
              {isDirty && (
                <Button
                  onClick={() => reset()}
                  variant="ghost"
                  isDisabled={!isDirty || isSubmitting}
                >
                  {t("features.feed.components.sidebar.resetButton")}
                </Button>
              )}
              <Button
                type="submit"
                colorScheme="blue"
                isDisabled={isSubmitting || !isDirty || errorsExist}
                isLoading={isSubmitting}
              >
                {t("features.feed.components.sidebar.saveButton")}
              </Button>
            </HStack>
          </Flex>
        </Stack>
      </form>
    </FormProvider>
  );
};
