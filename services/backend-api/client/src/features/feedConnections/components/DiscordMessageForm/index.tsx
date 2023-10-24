import { AddIcon } from "@chakra-ui/icons";
import {
  Button,
  Flex,
  Heading,
  Highlight,
  HStack,
  Stack,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
} from "@chakra-ui/react";
import { yupResolver } from "@hookform/resolvers/yup";
import { useContext, useState } from "react";
import { FormProvider, useFieldArray, useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { FiPlay } from "react-icons/fi";
import { motion } from "framer-motion";
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
import { DiscordMessageForumThreadForm } from "./DiscordMessageForumThreadForm";
import { DiscordMessageMentionForm } from "./DiscordMessageMentionForm";
import { DiscordMessagePlaceholderLimitsForm } from "./DiscordMessagePlaceholderLimitsForm";
import { CreateDiscordChannelConnectionPreviewInput } from "../../api";
import { SendTestArticleContext } from "../../../../contexts";
import { AnimatedComponent } from "../../../../components";
import { DiscordMessageComponentsForm } from "./DiscordMessageComponentsForm";
import { useUserFeed } from "../../../feed/hooks";
import { GetUserFeedArticlesInput } from "../../../feed/api";

type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;

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
    forumForms?: boolean;
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
  const { feed: userFeed } = useUserFeed({ feedId });
  const { t } = useTranslation();
  const [activeEmbedIndex, setActiveEmbedIndex] = useState(defaultIndex);
  const { isFetching: isSendingTestArticle, sendTestArticle } = useContext(SendTestArticleContext);

  const formMethods = useForm<DiscordMessageFormData>({
    resolver: yupResolver(discordMessageFormSchema),
    defaultValues: {
      componentRows: defaultValues?.componentRows,
      content: defaultValues?.content || "",
      customPlaceholders: defaultValues?.customPlaceholders,
      embeds: defaultValues?.embeds,
      enablePlaceholderFallback: defaultValues?.enablePlaceholderFallback,
      formatter: defaultValues?.formatter,
      forumThreadTags: defaultValues?.forumThreadTags,
      forumThreadTitle: defaultValues?.forumThreadTitle,
      mentions: defaultValues?.mentions,
      placeholderLimits: defaultValues?.placeholderLimits,
      splitOptions: defaultValues?.splitOptions,
    },
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
  const [
    splitOptions,
    content,
    formatOptions,
    watchedEmbeds,
    watchedMentions,
    placeholderLimits,
    enablePlaceholderFallback,
    customPlaceholders,
    forumThreadTags,
    forumThreadTitle,
    componentRows,
  ] = useWatch({
    control,
    name: [
      "splitOptions",
      "content",
      "formatter",
      "embeds",
      "mentions",
      "placeholderLimits",
      "enablePlaceholderFallback",
      "customPlaceholders",
      "forumThreadTags",
      "forumThreadTitle",
      "componentRows",
    ],
  });

  const previewInput: Omit<CreateDiscordChannelConnectionPreviewInput, "data"> & {
    data: Omit<CreateDiscordChannelConnectionPreviewInput["data"], "article"> & {
      article?: CreateDiscordChannelConnectionPreviewInput["data"]["article"] | undefined;
    };
  } = {
    connectionId: connection.id,
    feedId,
    data: {
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
      customPlaceholders,
      placeholderLimits,
      enablePlaceholderFallback,
      forumThreadTags,
      forumThreadTitle,
      componentRows,
    },
  };

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
        ...formData,
        content: formData.content?.trim(),
        embeds: embedsWithoutEmptyObjects,
        splitOptions: formData.splitOptions || null,
        forumThreadTags: formData.forumThreadTags || [],
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

  const onClickSendPreviewToDiscord = async () => {
    if (!previewInput.data.article) {
      return;
    }

    try {
      await sendTestArticle({
        connectionType: connection.type,
        previewInput: previewInput as CreateDiscordChannelConnectionPreviewInput,
      });
    } catch (err) {
      notifyError(t("common.errors.somethingWentWrong"), err as Error);
    }
  };

  const articleFormatOptions: GetUserFeedArticlesInput["data"]["formatter"] = {
    customPlaceholders,
    options: {
      dateFormat: userFeed?.formatOptions?.dateFormat,
      dateTimezone: userFeed?.formatOptions?.dateTimezone,
      formatTables: formatOptions?.formatTables || false,
      stripImages: formatOptions?.stripImages || false,
      disableImageLinkPreviews: formatOptions?.disableImageLinkPreviews || false,
    },
  };

  const errorsExist = Object.keys(errors).length > 0;

  return (
    <FormProvider {...formMethods}>
      <form onSubmit={handleSubmit(onSubmit)}>
        <Stack spacing={24} mb={24}>
          <Stack>
            <Stack>
              <HStack justifyContent="space-between" flexWrap="wrap" alignItems="center">
                <HStack spacing={4} alignItems="center" flexWrap="wrap">
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
                <Button
                  leftIcon={<FiPlay />}
                  onClick={onClickSendPreviewToDiscord}
                  size="sm"
                  colorScheme="blue"
                  isLoading={isSendingTestArticle}
                  isDisabled={isSendingTestArticle || !articleIdToPreview}
                >
                  {t("components.discordMessageForm.sendPreviewToDiscordButtonText")}
                </Button>
              </HStack>
              <Text>{t("components.discordMessageForm.previewSectionDescription")}</Text>
            </Stack>
            {connection.type === FeedConnectionType.DiscordChannel && (
              <DiscordChannelConnectionPreview
                connectionId={connection.id}
                data={previewInput.data as CreateDiscordChannelConnectionPreviewInput["data"]}
                feedId={feedId}
                hasErrors={errorsExist}
              />
            )}
          </Stack>
          {include?.forumForms && (
            <Stack>
              <Heading size="md">{t("components.discordMessageForumThreadForm.title")}</Heading>
              <DiscordMessageForumThreadForm
                articleFormatter={articleFormatOptions}
                connectionId={connection.id}
                feedId={feedId}
              />
            </Stack>
          )}
          <Stack>
            <Heading size="md">{t("components.discordMessageForm.textSectionTitle")}</Heading>
            <DiscordMessageContentForm />
          </Stack>
          <Stack>
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
                  <Button
                    onClick={onAddEmbed}
                    variant="ghost"
                    aria-label="Add new embed"
                    leftIcon={<AddIcon fontSize="sm" />}
                  >
                    Add
                  </Button>
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
          <Stack>
            <Heading size="md">Buttons</Heading>
            <DiscordMessageComponentsForm connectionId={connection.id} feedId={feedId} />
          </Stack>
          <Stack>
            <Heading size="md">{t("components.discordMessageMentionForm.title")}</Heading>
            <DiscordMessageMentionForm
              guildId={guildId}
              feedId={feedId}
              articleFormatter={articleFormatOptions}
            />
          </Stack>
          <Stack>
            <Heading size="md">Placeholder Limits</Heading>
            <DiscordMessagePlaceholderLimitsForm feedId={feedId} />
          </Stack>
          <AnimatedComponent>
            {isDirty && (
              <Flex
                as={motion.div}
                direction="row-reverse"
                position="fixed"
                bottom="-100px"
                left="50%"
                opacity="0"
                zIndex={100}
                transform="translate(-50%, -50%)"
                width={["90%", "90%", "80%", "80%", "1200px"]}
                borderRadius="md"
                paddingX={4}
                paddingY={2}
                bg="blue.600"
                animate={{ opacity: 1, bottom: "0px" }}
                exit={{ opacity: 0, bottom: "-100px" }}
              >
                <HStack justifyContent="space-between" width="100%">
                  <Text>You have unsaved changes!</Text>
                  <HStack>
                    <Button
                      onClick={() => reset()}
                      variant="ghost"
                      isDisabled={!isDirty || isSubmitting}
                    >
                      {t("features.feed.components.sidebar.resetButton")}
                    </Button>
                    <Button
                      type="submit"
                      colorScheme="blue"
                      isDisabled={isSubmitting || !isDirty || errorsExist}
                      isLoading={isSubmitting}
                    >
                      {t("features.feed.components.sidebar.saveButton")}
                    </Button>
                  </HStack>
                </HStack>
              </Flex>
            )}
          </AnimatedComponent>
        </Stack>
      </form>
    </FormProvider>
  );
};
