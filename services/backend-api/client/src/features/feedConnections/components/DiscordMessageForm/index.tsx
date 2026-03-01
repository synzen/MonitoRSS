import { AddIcon, LockIcon } from "@chakra-ui/icons";
import {
  Box,
  Button,
  Center,
  Flex,
  FormControl,
  FormHelperText,
  FormLabel,
  Heading,
  Highlight,
  HStack,
  Input,
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
import { Suspense, useContext, useRef, useState } from "react";
import { FormProvider, useFieldArray, useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { motion } from "motion/react";
import { FaDiscord } from "react-icons/fa";
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
import { PricingDialogContext, SendTestArticleContext } from "../../../../contexts";
import { useIsFeatureAllowed } from "../../../../hooks";
import { BlockableFeature } from "../../../../constants";
import { useSendTestArticleDirect } from "../../hooks/useSendTestArticleDirect";
import { SendTestArticleDeliveryStatus } from "@/types";
import { AnimatedComponent } from "../../../../components";
import { DiscordMessageComponentsForm } from "./DiscordMessageComponentsForm";
import { SuspenseErrorBoundary } from "../../../../components/SuspenseErrorBoundary";
import {
  UserFeedConnectionProvider,
  useUserFeedConnectionContext,
} from "../../../../contexts/UserFeedConnectionContext";
import getChakraColor from "../../../../utils/getChakraColor";
import { DiscordMessageChannelThreadForm } from "./DiscordMessageChannelThreadForm";
import { lazyWithRetries } from "../../../../utils/lazyImportWithRetry";
import {
  PageAlertContext,
  PageAlertContextOutlet,
  PageAlertProvider,
} from "../../../../contexts/PageAlertContext";

const DiscordMessageEmbedForm = lazyWithRetries(() =>
  import("./DiscordMessageEmbedForm").then(({ DiscordMessageEmbedForm: component }) => ({
    default: component,
  })),
);

const DiscordChannelConnectionPreview = lazyWithRetries(() =>
  import("./DiscordChannelConnectionPreview").then(
    ({ DiscordChannelConnectionPreview: component }) => ({
      default: component,
    }),
  ),
);

type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;

interface BrandingExtra {
  applicationWebhook?: {
    name: string;
    iconUrl?: string;
    channelId: string;
  };
}

interface Props {
  onClickSave: (data: DiscordMessageFormData, extra?: BrandingExtra) => Promise<void>;
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
  const { isFetching: isSendingTestArticle, sendTestArticle } = useContext(SendTestArticleContext);
  const { allowed: webhooksAllowed } = useIsFeatureAllowed({
    feature: BlockableFeature.DiscordWebhooks,
  });
  const { onOpen: onOpenPricingDialog } = useContext(PricingDialogContext);
  const sendTestArticleDirectMutation = useSendTestArticleDirect();
  const existingWebhookName = connection.details.webhook?.name || "";
  const existingWebhookIconUrl = connection.details.webhook?.iconUrl || "";
  const [webhookDisplayName, setWebhookDisplayName] = useState(existingWebhookName);
  const [webhookAvatarUrl, setWebhookAvatarUrl] = useState(existingWebhookIconUrl);
  const skipBrandingRef = useRef(false);
  const hasBrandingValues = !webhooksAllowed && !!webhookDisplayName.trim();
  const showForumForms =
    connection.details.channel?.type === "forum" || connection.details.webhook?.type === "forum";
  const showChannelThreadForm = connection.details.channel?.type === "new-thread";
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
    channelNewThreadTitle,
    channelNewThreadExcludesPreview,
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
      "channelNewThreadTitle",
      "channelNewThreadExcludesPreview",
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
      channelNewThreadTitle,
      channelNewThreadExcludesPreview,
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

      let brandingExtra: BrandingExtra | undefined;
      const shouldSkipBranding = skipBrandingRef.current;
      skipBrandingRef.current = false;

      const brandingChanged =
        webhookDisplayName !== existingWebhookName || webhookAvatarUrl !== existingWebhookIconUrl;

      if (webhooksAllowed && !shouldSkipBranding && webhookDisplayName && brandingChanged) {
        const channelId = connection.details.webhook?.channelId || connection.details.channel?.id;

        if (channelId) {
          brandingExtra = {
            applicationWebhook: {
              name: webhookDisplayName,
              iconUrl: webhookAvatarUrl || undefined,
              channelId,
            },
          };
        }
      }

      await onClickSave(toSubmit, brandingExtra);
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
            <Stack as="aside" aria-labelledby="preview-message-format-title">
              <PageAlertProvider>
                <PageAlertContext.Consumer>
                  {({ createErrorAlert, createInfoAlert, createSuccessAlert }) => (
                    <Stack isolation="isolate">
                      <HStack justifyContent="space-between" flexWrap="wrap" alignItems="center">
                        <HStack spacing={4} alignItems="center" flexWrap="wrap">
                          <Heading as="h3" size="sm" id="preview-message-format-title">
                            {t("components.discordMessageForm.previewSectionTitle")}
                          </Heading>
                          {isDirty && (
                            <Text fontSize="sm" fontWeight={600}>
                              <Highlight
                                query={t(
                                  "components.discordMessageForm.previewSectionUnsavedWarning",
                                )}
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
                          leftIcon={<FaDiscord fontSize={18} color={getChakraColor("gray.700")} />}
                          onClick={async () => {
                            if (
                              isSendingTestArticle ||
                              sendTestArticleDirectMutation.isLoading ||
                              !articleIdToPreview ||
                              !previewInput.data.article
                            ) {
                              return;
                            }

                            try {
                              if (!webhooksAllowed && webhookDisplayName.trim()) {
                                const channelId =
                                  connection.details.channel?.id ||
                                  connection.details.webhook?.channelId;

                                if (!channelId) return;

                                const response = await sendTestArticleDirectMutation.mutateAsync({
                                  feedId: userFeed.id,
                                  data: {
                                    article: { id: articleIdToPreview },
                                    channelId,
                                    content: previewInput.data.content,
                                    embeds: previewInput.data.embeds,
                                    placeholderLimits: previewInput.data.placeholderLimits,
                                    webhook: {
                                      name: webhookDisplayName,
                                      iconUrl: webhookAvatarUrl || undefined,
                                    },
                                  },
                                });

                                if (
                                  response.result.status === SendTestArticleDeliveryStatus.Success
                                ) {
                                  createSuccessAlert({
                                    title: "Article sent to Discord successfully!",
                                  });
                                } else {
                                  createErrorAlert({
                                    title: "Failed to send test article.",
                                  });
                                }

                                return;
                              }

                              const resultInfo = await sendTestArticle(
                                {
                                  connectionType: connection.key,
                                  previewInput:
                                    previewInput as CreateDiscordChannelConnectionPreviewInput,
                                },
                                {
                                  disableToast: true,
                                },
                              );

                              if (resultInfo?.status === "info") {
                                createInfoAlert({
                                  title: resultInfo.title,
                                  description: resultInfo.description,
                                });
                              } else if (resultInfo?.status === "success") {
                                createSuccessAlert({
                                  title: resultInfo.title,
                                  description: resultInfo.description,
                                });
                              } else if (resultInfo?.status === "error") {
                                createErrorAlert({
                                  title: resultInfo.title,
                                  description: resultInfo.description,
                                });
                              }
                            } catch (err) {}
                          }}
                          size="sm"
                          colorScheme="blue"
                          isLoading={
                            isSendingTestArticle || sendTestArticleDirectMutation.isLoading
                          }
                          aria-disabled={
                            isSendingTestArticle ||
                            sendTestArticleDirectMutation.isLoading ||
                            !articleIdToPreview
                          }
                        >
                          <span>
                            {t("components.discordMessageForm.sendPreviewToDiscordButtonText")}
                          </span>
                        </Button>
                      </HStack>
                      <PageAlertContextOutlet />
                      {/* {sendTestArticleError && (
                    <Box mt={3} mb={3}>
                      <InlineErrorAlert
                        title="Failed to send preview article to Discord"
                        description={sendTestArticleError}
                      />
                    </Box>
                  )} */}
                      <Text>{t("components.discordMessageForm.previewSectionDescription")}</Text>
                    </Stack>
                  )}
                </PageAlertContext.Consumer>
              </PageAlertProvider>
              <Box>
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
                        data={
                          previewInput.data as CreateDiscordChannelConnectionPreviewInput["data"]
                        }
                        feedId={userFeed.id}
                        hasErrors={errorsExist}
                        usernameOverride={webhookDisplayName || undefined}
                        avatarUrlOverride={webhookAvatarUrl || undefined}
                      />
                    </Suspense>
                  </SuspenseErrorBoundary>
                )}
              </Box>
              <Stack
                spacing={3}
                mt={4}
                p={!webhooksAllowed ? 3 : 0}
                border={!webhooksAllowed ? "1px solid" : undefined}
                borderColor={!webhooksAllowed ? "whiteAlpha.200" : undefined}
                bg={!webhooksAllowed ? "gray.800" : undefined}
                borderRadius={!webhooksAllowed ? "md" : undefined}
              >
                <Heading as="h4" size="xs">
                  Branding
                </Heading>
                {!webhooksAllowed && (
                  <HStack spacing={2}>
                    <LockIcon boxSize={3} color="whiteAlpha.700" />
                    <Text fontSize="xs" color="whiteAlpha.700">
                      Free plan — preview how your branding looks, then upgrade to save it.
                    </Text>
                  </HStack>
                )}
                <HStack spacing={4} flexWrap="wrap">
                  <FormControl flex={1} minW="200px">
                    <FormLabel fontSize="sm">Display Name</FormLabel>
                    <Input
                      size="sm"
                      bg="gray.800"
                      placeholder="e.g. Gaming News"
                      value={webhookDisplayName}
                      onChange={(e) => setWebhookDisplayName(e.target.value)}
                    />
                    <FormHelperText fontSize="xs">
                      The name shown as the message author
                    </FormHelperText>
                  </FormControl>
                  <FormControl flex={1} minW="200px">
                    <FormLabel fontSize="sm">Avatar URL</FormLabel>
                    <Input
                      size="sm"
                      bg="gray.800"
                      placeholder="https://example.com/avatar.png"
                      value={webhookAvatarUrl}
                      onChange={(e) => setWebhookAvatarUrl(e.target.value)}
                    />
                    <FormHelperText fontSize="xs">
                      The avatar shown next to the message
                    </FormHelperText>
                  </FormControl>
                </HStack>
              </Stack>
            </Stack>
            {showForumForms && (
              <Stack>
                <Heading size="sm" as="h3">
                  {t("components.discordMessageForumThreadForm.title")}
                </Heading>
                <DiscordMessageForumThreadForm />
              </Stack>
            )}
            {showChannelThreadForm && (
              <Stack>
                <Heading size="sm" as="h3">
                  Channel Thread
                </Heading>
                <DiscordMessageChannelThreadForm />
              </Stack>
            )}
            <Stack>
              <Heading size="sm" as="h3">
                {t("components.discordMessageForm.textSectionTitle")}
              </Heading>
              <DiscordMessageContentForm />
            </Stack>
            <Stack>
              <Heading size="sm" as="h3">
                {t("components.discordMessageForm.embedSectionTitle")}
              </Heading>
              <Text>{t("components.discordMessageForm.embedSectionDescription")}</Text>
              <Tabs variant="solid-rounded" index={activeEmbedIndex} onChange={onEmbedTabChanged}>
                <HStack overflow="auto" flexWrap="wrap">
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
                      Add new embed
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
                                Delete embed {index + 1}
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
              <Heading size="sm" as="h3">
                Buttons
              </Heading>
              <DiscordMessageComponentsForm connectionId={connection.id} feedId={userFeed.id} />
            </Stack>
            <Stack>
              <Heading size="sm" as="h3">
                {t("components.discordMessageMentionForm.title")}
              </Heading>
              <DiscordMessageMentionForm guildId={guildId} />
            </Stack>
            <Stack>
              <Heading size="sm" as="h3">
                Placeholder Limits
              </Heading>
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
                  <HStack justifyContent="space-between" width="100%" flexWrap="wrap" gap={4}>
                    <Text>You have unsaved changes on this page!</Text>
                    <HStack flexWrap="wrap">
                      <Button
                        onClick={() => reset()}
                        variant="ghost"
                        isDisabled={!isDirty || isSubmitting}
                      >
                        <span>Discard all changes</span>
                      </Button>
                      {hasBrandingValues ? (
                        <>
                          <Button
                            type="submit"
                            variant="outline"
                            isDisabled={isSubmitting || !isDirty || errorsExist}
                            isLoading={isSubmitting}
                            onClick={() => {
                              skipBrandingRef.current = true;
                            }}
                          >
                            <span>Save without branding</span>
                          </Button>
                          <Button colorScheme="blue" onClick={onOpenPricingDialog}>
                            <span>Upgrade to save with branding</span>
                          </Button>
                        </>
                      ) : (
                        <Button
                          type="submit"
                          colorScheme="blue"
                          isDisabled={isSubmitting || !isDirty || errorsExist}
                          isLoading={isSubmitting}
                        >
                          <span>Save all changes</span>
                        </Button>
                      )}
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
