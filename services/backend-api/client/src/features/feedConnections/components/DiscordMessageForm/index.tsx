import { AddIcon } from "@chakra-ui/icons";
import {
  Box,
  Button,
  Center,
  Flex,
  Heading,
  Highlight,
  HStack,
  Spinner,
  Stack,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
} from "@chakra-ui/react";
import { yupResolver } from "@hookform/resolvers/yup";
import { lazy, Suspense, useContext, useState } from "react";
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
import { notifyError } from "../../../../utils/notifyError";
import { FeedConnectionType, FeedDiscordChannelConnection } from "../../../../types";
import { DiscordMessageForumThreadForm } from "./DiscordMessageForumThreadForm";
import { DiscordMessageMentionForm } from "./DiscordMessageMentionForm";
import { DiscordMessagePlaceholderLimitsForm } from "./DiscordMessagePlaceholderLimitsForm";
import { CreateDiscordChannelConnectionPreviewInput } from "../../api";
import { SendTestArticleContext } from "../../../../contexts";
import { AnimatedComponent, InlineErrorAlert } from "../../../../components";
import { DiscordMessageComponentsForm } from "./DiscordMessageComponentsForm";
import { SuspenseErrorBoundary } from "../../../../components/SuspenseErrorBoundary";
import {
  UserFeedConnectionProvider,
  useUserFeedConnectionContext,
} from "../../../../contexts/UserFeedConnectionContext";

const DiscordMessageEmbedForm = lazy(() =>
  import("./DiscordMessageEmbedForm").then(({ DiscordMessageEmbedForm: component }) => ({
    default: component,
  }))
);

const DiscordChannelConnectionPreview = lazy(() =>
  import("./DiscordChannelConnectionPreview").then(
    ({ DiscordChannelConnectionPreview: component }) => ({
      default: component,
    })
  )
);

type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;

interface Props {
  onClickSave: (data: DiscordMessageFormData) => Promise<void>;
  articleIdToPreview?: string;
  guildId: string | undefined;
}

const templateEmbed: DiscordMessageEmbedFormData = Object.freeze({});

export const DiscordMessageForm = ({ onClickSave, articleIdToPreview, guildId }: Props) => {
  const { userFeed, connection } = useUserFeedConnectionContext<FeedDiscordChannelConnection>();
  const defaultIndex = connection.details?.embeds?.length
    ? connection.details.embeds.length - 1
    : 0;
  const { t } = useTranslation();
  const [activeEmbedIndex, setActiveEmbedIndex] = useState(defaultIndex);
  const {
    isFetching: isSendingTestArticle,
    sendTestArticle,
    error: sendTestArticleError,
  } = useContext(SendTestArticleContext);
  const showForumForms =
    connection.details.channel?.type === "forum" || connection.details.webhook?.type === "forum";
  const formMethods = useForm<DiscordMessageFormData>({
    resolver: yupResolver(discordMessageFormSchema),
    defaultValues: {
      content: connection?.details.content,
      splitOptions: connection?.splitOptions || null,
      forumThreadTitle: connection?.details.forumThreadTitle,
      forumThreadTags: connection?.details.forumThreadTags || [],
      mentions: connection?.mentions,
      customPlaceholders: connection?.customPlaceholders,
      componentRows: connection?.details.componentRows,
      externalProperties: userFeed?.externalProperties,
      ...connection?.details,
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
    externalProperties,
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
      "externalProperties",
    ],
  });

  const previewInput: Omit<CreateDiscordChannelConnectionPreviewInput, "data"> & {
    data: Omit<CreateDiscordChannelConnectionPreviewInput["data"], "article"> & {
      article?: CreateDiscordChannelConnectionPreviewInput["data"]["article"] | undefined;
    };
  } = {
    connectionId: connection.id,
    feedId: userFeed.id,
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
      externalProperties,
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
      await sendTestArticle(
        {
          connectionType: connection.key,
          previewInput: previewInput as CreateDiscordChannelConnectionPreviewInput,
        },
        {
          disableToastErrors: true,
        }
      );
    } catch (err) {}
  };

  const errorsExist = Object.keys(errors).length > 0;

  return (
    <UserFeedConnectionProvider
      feedId={userFeed.id}
      connectionId={connection.id}
      articleFormatOptions={{
        customPlaceholders,
        formatTables: formatOptions?.formatTables || false,
        stripImages: formatOptions?.stripImages || false,
        disableImageLinkPreviews: formatOptions?.disableImageLinkPreviews || false,
        ignoreNewLines: formatOptions?.ignoreNewLines || false,
      }}
    >
      <FormProvider {...formMethods}>
        <form onSubmit={handleSubmit(onSubmit)}>
          <Stack spacing={24} mb={36}>
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
                    <span>{t("components.discordMessageForm.sendPreviewToDiscordButtonText")}</span>
                  </Button>
                </HStack>
                <Text>{t("components.discordMessageForm.previewSectionDescription")}</Text>
                {sendTestArticleError && (
                  <Box mt={3} mb={3}>
                    <InlineErrorAlert
                      title="Failed to send preview article to Discord"
                      description={sendTestArticleError}
                    />
                  </Box>
                )}
              </Stack>
              {connection.key === FeedConnectionType.DiscordChannel && (
                <SuspenseErrorBoundary>
                  <Suspense
                    fallback={
                      <Center my={8}>
                        <Spinner />
                      </Center>
                    }
                  >
                    <DiscordChannelConnectionPreview
                      connectionId={connection.id}
                      data={previewInput.data as CreateDiscordChannelConnectionPreviewInput["data"]}
                      feedId={userFeed.id}
                      hasErrors={errorsExist}
                    />
                  </Suspense>
                </SuspenseErrorBoundary>
              )}
            </Stack>
            {showForumForms && (
              <Stack>
                <Heading size="md">{t("components.discordMessageForumThreadForm.title")}</Heading>
                <DiscordMessageForumThreadForm />
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
                  {!!embeds.length && (
                    <TabList>
                      {embeds?.map((embed, index) => (
                        <Tab key={embed.id}>Embed {index + 1}</Tab>
                      ))}
                    </TabList>
                  )}
                  {(embeds?.length ?? 0) < 10 && (
                    <Button
                      onClick={onAddEmbed}
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
                      <SuspenseErrorBoundary>
                        <Suspense fallback={<Spinner />}>
                          <Stack spacing={8}>
                            <Flex justifyContent="flex-end">
                              <Button
                                colorScheme="red"
                                size="sm"
                                variant="outline"
                                onClick={() => onRemoveEmbed(index)}
                              >
                                {t(
                                  "features.feedConnections.components.embedForm.deleteButtonText"
                                )}
                              </Button>
                            </Flex>
                            <DiscordMessageEmbedForm index={index} />
                          </Stack>
                        </Suspense>
                      </SuspenseErrorBoundary>
                    </TabPanel>
                  ))}
                </TabPanels>
              </Tabs>
            </Stack>
            <Stack>
              <Heading size="md">Buttons</Heading>
              <DiscordMessageComponentsForm connectionId={connection.id} feedId={userFeed.id} />
            </Stack>
            <Stack>
              <Heading size="md">{t("components.discordMessageMentionForm.title")}</Heading>
              <DiscordMessageMentionForm guildId={guildId} />
            </Stack>
            <Stack>
              <Heading size="md">Placeholder Limits</Heading>
              <DiscordMessagePlaceholderLimitsForm />
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
                        <span>{t("features.feed.components.sidebar.resetButton")}</span>
                      </Button>
                      <Button
                        type="submit"
                        colorScheme="blue"
                        isDisabled={isSubmitting || !isDirty || errorsExist}
                        isLoading={isSubmitting}
                      >
                        <span>{t("features.feed.components.sidebar.saveButton")}</span>
                      </Button>
                    </HStack>
                  </HStack>
                </Flex>
              )}
            </AnimatedComponent>
          </Stack>
        </form>
      </FormProvider>
    </UserFeedConnectionProvider>
  );
};
