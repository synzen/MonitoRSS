import { FaPlus, FaLock, FaCircleInfo } from "react-icons/fa6";
import {
  Box,
  Button,
  Center,
  chakra,
  Flex,
  Heading,
  HStack,
  Icon,
  Input,
  Spinner,
  Stack,
  Tabs,
  Text,
  VisuallyHidden,
} from "@chakra-ui/react";
import { yupResolver } from "@hookform/resolvers/yup";
import { Suspense, useContext, useEffect, useRef, useState } from "react";
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
import { notifyError } from "@/utils/notifyError";
import {
  FeedConnectionType,
  FeedDiscordChannelConnection,
  SendTestArticleDeliveryStatus,
} from "@/types";
import { DiscordMessageForumThreadForm } from "./DiscordMessageForumThreadForm";
import { DiscordMessageMentionForm, MentionsValue } from "./DiscordMessageMentionForm";
import { DiscordMessagePlaceholderLimitsForm } from "./DiscordMessagePlaceholderLimitsForm";
import { CreateDiscordChannelConnectionPreviewInput } from "../../api";
import { getConnectionWebhookChannelId, getConnectionWebhookThreadId } from "../../utils";
import {
  PricingDialogContext,
  useIsFeatureAllowed,
  BlockableFeature,
} from "@/features/subscriptionProducts";
import { SendTestArticleContext } from "../../../messageBuilder/contexts/SendTestArticleContext";

import { useSendTestArticleDirect } from "../../hooks/useSendTestArticleDirect";
import { AnimatedComponent, UnsavedChangesBadge } from "@/components";
import { PrimaryActionButton } from "@/components/PrimaryActionButton";
import { SafeLoadingButton } from "@/components/SafeLoadingButton";
import { DestructiveActionButton } from "@/components/DestructiveActionButton";
import { DiscordMessageComponentsForm } from "./DiscordMessageComponentsForm";
import { SuspenseErrorBoundary } from "@/components/SuspenseErrorBoundary";
import { UserFeedConnectionProvider, useUserFeedConnectionContext } from "@/features/feed";
import { DiscordMessageChannelThreadForm } from "./DiscordMessageChannelThreadForm";
import { lazyWithRetries } from "@/utils/lazyImportWithRetry";
import {
  PageAlertContext,
  PageAlertContextOutlet,
  PageAlertProvider,
} from "@/contexts/PageAlertContext";
import { Field } from "@/components/ui/field";

const MotionDiv = chakra(motion.div);

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

export interface SaveExtra {
  applicationWebhook?: {
    name?: string;
    iconUrl?: string;
    channelId: string;
    threadId?: string;
  };
  channelId?: string;
}

interface Props {
  onClickSave: (data: DiscordMessageFormData, extra?: SaveExtra) => Promise<void>;
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

      let brandingExtra: SaveExtra | undefined;
      const shouldSkipBranding = skipBrandingRef.current;
      skipBrandingRef.current = false;

      const brandingChanged =
        webhookDisplayName !== existingWebhookName || webhookAvatarUrl !== existingWebhookIconUrl;

      if (webhooksAllowed && !shouldSkipBranding && brandingChanged) {
        const channelId = getConnectionWebhookChannelId(connection);

        if (channelId) {
          const hasWebhookBrandingInput = !!webhookDisplayName.trim() || !!webhookAvatarUrl.trim();

          if (hasWebhookBrandingInput) {
            brandingExtra = {
              applicationWebhook: {
                name: webhookDisplayName || undefined,
                iconUrl: webhookAvatarUrl || undefined,
                channelId,
                threadId: getConnectionWebhookThreadId(connection),
              },
            };
          } else {
            brandingExtra = {
              channelId,
            };
          }
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

  const formRef = useRef<HTMLFormElement>(null);
  const wasSubmitting = useRef(false);
  const [savedAnnouncement, setSavedAnnouncement] = useState("");

  useEffect(() => {
    if (wasSubmitting.current && !isSubmitting && !isDirty && formRef.current) {
      const form = formRef.current;

      if (!form.hasAttribute("tabindex")) {
        form.setAttribute("tabindex", "-1");
      }

      form.focus();
      setSavedAnnouncement("Changes saved.");
      const timer = setTimeout(() => setSavedAnnouncement(""), 1000);

      wasSubmitting.current = isSubmitting;

      return () => clearTimeout(timer);
    }

    wasSubmitting.current = isSubmitting;

    return undefined;
  }, [isSubmitting, isDirty]);

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
        <form ref={formRef} onSubmit={handleSubmit(onSubmit)} aria-label="Message format settings">
          <VisuallyHidden>
            <div role="status" aria-live="polite" aria-atomic="true">
              {savedAnnouncement}
            </div>
          </VisuallyHidden>
          <Stack gap={24} mb={36}>
            <Stack as="aside" aria-labelledby="preview-message-format-title">
              <PageAlertProvider>
                <PageAlertContext.Consumer>
                  {({ createErrorAlert, createInfoAlert, createSuccessAlert }) => (
                    <Stack isolation="isolate">
                      <HStack justifyContent="space-between" flexWrap="wrap" alignItems="center">
                        <HStack gap={4} alignItems="center" flexWrap="wrap">
                          <Heading as="h3" size="sm" id="preview-message-format-title">
                            {t("components.discordMessageForm.previewSectionTitle")}
                          </Heading>
                          {isDirty && (
                            <UnsavedChangesBadge
                              label={t(
                                "components.discordMessageForm.previewSectionUnsavedWarning",
                              )}
                            />
                          )}
                        </HStack>
                        <SafeLoadingButton
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
                          colorPalette="brand"
                          loading={isSendingTestArticle || sendTestArticleDirectMutation.isLoading}
                          aria-disabled={
                            isSendingTestArticle ||
                            sendTestArticleDirectMutation.isLoading ||
                            !articleIdToPreview
                          }
                        >
                          <FaDiscord fontSize={18} />
                          <span>
                            {t("components.discordMessageForm.sendPreviewToDiscordButtonText")}
                          </span>
                        </SafeLoadingButton>
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
                gap={3}
                mt={4}
                p={!webhooksAllowed ? 3 : 0}
                border={!webhooksAllowed ? "1px solid" : undefined}
                borderColor={!webhooksAllowed ? "border" : undefined}
                bg={!webhooksAllowed ? "bg.subtle" : undefined}
                borderRadius={!webhooksAllowed ? "md" : undefined}
              >
                <Heading as="h4" size="xs">
                  Branding
                </Heading>
                {!webhooksAllowed && (
                  <HStack gap={2}>
                    <Icon as={FaLock} boxSize={3} color="fg.muted" />
                    <Text fontSize="xs" color="fg.muted">
                      Upgrade to customize your branding. Preview it here first!
                    </Text>
                  </HStack>
                )}
                <HStack gap={4} flexWrap="wrap">
                  <Field
                    label="Display Name"
                    helperText="The name shown as the message author"
                    flex={1}
                    minW="200px"
                  >
                    <Input
                      size="sm"
                      placeholder="e.g. Gaming News"
                      value={webhookDisplayName}
                      onChange={(e) => setWebhookDisplayName(e.target.value)}
                    />
                  </Field>
                  <Field
                    label="Avatar URL"
                    helperText="The avatar shown next to the message"
                    flex={1}
                    minW="200px"
                  >
                    <Input
                      size="sm"
                      placeholder="https://example.com/avatar.png"
                      value={webhookAvatarUrl}
                      onChange={(e) => setWebhookAvatarUrl(e.target.value)}
                    />
                  </Field>
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
              <Tabs.Root
                variant="line"
                value={String(activeEmbedIndex)}
                onValueChange={(e) => onEmbedTabChanged(Number(e.value))}
              >
                <HStack overflow="auto" flexWrap="wrap">
                  {!!embeds.length && (
                    <Tabs.List>
                      {embeds?.map((embed, index) => (
                        <Tabs.Trigger key={embed.id} value={String(index)}>
                          Embed {index + 1}
                        </Tabs.Trigger>
                      ))}
                    </Tabs.List>
                  )}
                  {(embeds?.length ?? 0) < 10 && (
                    <Button
                      onClick={onAddEmbed}
                      aria-label="Add new embed"
                      variant="outline"
                      colorPalette="brand"
                    >
                      <Icon as={FaPlus} fontSize="sm" />
                      Add new embed
                    </Button>
                  )}
                </HStack>
                <Tabs.ContentGroup>
                  {embeds?.map((embed, index) => (
                    <Tabs.Content key={embed.id} value={String(index)}>
                      <SuspenseErrorBoundary>
                        <Suspense fallback={<Spinner />}>
                          <Stack gap={8}>
                            <Flex justifyContent="flex-end">
                              <DestructiveActionButton
                                size="sm"
                                onClick={() => onRemoveEmbed(index)}
                              >
                                Delete embed {index + 1}
                              </DestructiveActionButton>
                            </Flex>
                            <DiscordMessageEmbedForm index={index} />
                          </Stack>
                        </Suspense>
                      </SuspenseErrorBoundary>
                    </Tabs.Content>
                  ))}
                </Tabs.ContentGroup>
              </Tabs.Root>
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
              <DiscordMessageMentionForm
                guildId={guildId}
                value={formMethods.watch("mentions") as MentionsValue | undefined}
                onChange={(v) => formMethods.setValue("mentions", v as any, { shouldDirty: true })}
              />
            </Stack>
            <Stack>
              <Heading size="sm" as="h3">
                Placeholder Limits
              </Heading>
              <DiscordMessagePlaceholderLimitsForm
                value={formMethods.watch("placeholderLimits") ?? []}
                onChange={(v) =>
                  formMethods.setValue("placeholderLimits", v as any, { shouldDirty: true })
                }
              />
            </Stack>
            <AnimatedComponent>
              {isDirty && (
                <MotionDiv
                  display="flex"
                  flexDirection="row-reverse"
                  position="fixed"
                  bottom="-100px"
                  left="50%"
                  opacity="0"
                  zIndex={100}
                  transform="translate(-50%, -50%)"
                  width={["90%", "90%", "80%", "80%", "1200px"]}
                  borderRadius="l3"
                  paddingX={4}
                  paddingY={2}
                  bg="bg.emphasized"
                  borderWidth="1px"
                  borderColor="border.emphasized"
                  borderLeftWidth="4px"
                  borderLeftColor="brandSolid"
                  boxShadow="xl"
                  animate={{ opacity: 1, bottom: "0px" }}
                  exit={{ opacity: 0, bottom: "-100px" }}
                >
                  <HStack justifyContent="space-between" width="100%" flexWrap="wrap" gap={4}>
                    <HStack gap={2}>
                      <Icon as={FaCircleInfo} color="text.link" aria-hidden />
                      <Text>You have unsaved changes on this page!</Text>
                    </HStack>
                    <HStack flexWrap="wrap">
                      <Button
                        onClick={() => reset()}
                        variant="ghost"
                        disabled={!isDirty || isSubmitting}
                      >
                        <span>Discard all changes</span>
                      </Button>
                      {hasBrandingValues ? (
                        <>
                          <SafeLoadingButton
                            type="submit"
                            variant="outline"
                            disabled={!isDirty || errorsExist}
                            loading={isSubmitting}
                            onClick={() => {
                              skipBrandingRef.current = true;
                            }}
                          >
                            <span>Save without branding</span>
                          </SafeLoadingButton>
                          <PrimaryActionButton onClick={onOpenPricingDialog}>
                            <span>Upgrade to save with branding</span>
                          </PrimaryActionButton>
                        </>
                      ) : (
                        <PrimaryActionButton
                          type="submit"
                          disabled={!isDirty || errorsExist}
                          loading={isSubmitting}
                        >
                          <span>Save all changes</span>
                        </PrimaryActionButton>
                      )}
                    </HStack>
                  </HStack>
                </MotionDiv>
              )}
            </AnimatedComponent>
          </Stack>
        </form>
      </FormProvider>
    </UserFeedConnectionProvider>
  );
};
