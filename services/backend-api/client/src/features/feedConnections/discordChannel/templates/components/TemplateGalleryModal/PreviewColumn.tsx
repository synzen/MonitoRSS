import React from "react";
import { FaDiscord, FaCircleInfo, FaLock } from "react-icons/fa6";
import { VStack, Box, Skeleton, Text, HStack, Input, Icon, chakra } from "@chakra-ui/react";
import { Alert } from "@/components/ui/alert";
import { Panel } from "@/components/Panel";
import { SafeLoadingButton } from "@/components/SafeLoadingButton";
import { Field } from "@/components/ui/field";
import { NativeSelectRoot, NativeSelectField } from "@/components/ui/native-select";
import {
  DiscordMessageDisplay,
  resolvePreviewAvatarUrl,
} from "../../../shared/components/DiscordMessageDisplay";
import { TestSendFeedback } from "../../types";
import { Article, Branding } from "./types";
import { useBrandingContext } from "./BrandingContext";
import { useDiscordBot } from "@/features/discordUser";
import { DiscordUnfurlNote } from "./DiscordUnfurlNote";
import { previewMayUnfurl } from "./discordUnfurl";

const PreviewPlaceholder = ({ children }: { children: React.ReactNode }) => (
  <Box p={8} textAlign="center" bg="bg.panel" borderRadius="l3" color="fg.subtle">
    {children}
  </Box>
);

export interface PreviewColumnProps {
  articles: Article[];
  selectedArticleId?: string;
  onArticleChange: (articleId: string) => void;
  selectedTemplateId?: string;
  previewMessages: Array<Record<string, unknown>>;
  isActuallyLoading: boolean;
  isPreviewError: boolean;
  showComparisonPreview?: boolean;
  currentFormatMessages: Array<Record<string, unknown>>;
  isCurrentFormatLoading: boolean;
  isCurrentFormatError: boolean;
  onTestSend?: (branding?: Branding) => void;
  isTestSendLoading?: boolean;
  canTestSend: boolean;
  hasArticles: boolean;
  testSendFeedback?: TestSendFeedback | null;
}

export const PreviewColumn = ({
  articles,
  selectedArticleId,
  onArticleChange,
  selectedTemplateId,
  previewMessages,
  isActuallyLoading,
  isPreviewError,
  showComparisonPreview,
  currentFormatMessages,
  isCurrentFormatLoading,
  isCurrentFormatError,
  onTestSend,
  isTestSendLoading,
  canTestSend,
  hasArticles,
  testSendFeedback,
}: PreviewColumnProps) => {
  const {
    displayName: brandingDisplayName,
    setDisplayName: onBrandingDisplayNameChange,
    avatarUrl: brandingAvatarUrl,
    setAvatarUrl: onBrandingAvatarUrlChange,
    isDisabled: isBrandingDisabled,
    disabledReason: brandingDisabledReason,
    webhooksAllowed,
    hasBrandingValues,
  } = useBrandingContext();
  const { data: bot } = useDiscordBot();
  const resolvedAvatarUrl = resolvePreviewAvatarUrl({
    brandingAvatarUrl,
    brandingDisplayName,
    botAvatarUrl: bot?.result.avatar,
  });

  const showUnfurlNote = previewMayUnfurl(previewMessages);

  return (
    <Panel
      surface="subtle"
      p={4}
      minH={{ base: "200px", lg: "400px" }}
      role="region"
      aria-label="Template preview"
      aria-busy={isActuallyLoading || isCurrentFormatLoading}
    >
      {articles.length > 0 && (
        <Field mb={4}>
          <chakra.label htmlFor="article-selector" fontSize="xs" color="fg.muted" mb={1}>
            Preview article
          </chakra.label>
          <NativeSelectRoot size="sm">
            <NativeSelectField
              id="article-selector"
              value={selectedArticleId || ""}
              onChange={(e) => onArticleChange(e.target.value)}
            >
              {articles.map((article) => (
                <option key={article.id} value={article.id} style={{ backgroundColor: "#2D3748" }}>
                  {article.title || article.id}
                </option>
              ))}
            </NativeSelectField>
          </NativeSelectRoot>
        </Field>
      )}
      {previewMessages.length > 0 && (
        <Panel mb={4} p={3}>
          {isBrandingDisabled && (
            <HStack gap={2} mb={2} id="branding-disabled-reason">
              <Icon as={FaCircleInfo} boxSize={3} color="fg.muted" aria-hidden="true" />
              <Text fontSize="sm" color="fg.muted">
                {brandingDisabledReason}
              </Text>
            </HStack>
          )}
          {!isBrandingDisabled && !webhooksAllowed && (
            <HStack gap={2} mb={2}>
              <Icon as={FaLock} boxSize={3} color="fg.muted" />
              <Text fontSize="xs" color="fg.muted">
                Upgrade to customize your branding. Preview it here first!
              </Text>
            </HStack>
          )}
          <HStack gap={3} flexWrap="wrap">
            <Field flex={1} minW="150px" disabled={isBrandingDisabled}>
              <chakra.label htmlFor="branding-display-name" fontSize="xs" color="fg.muted" mb={1}>
                Display Name
              </chakra.label>
              <Input
                id="branding-display-name"
                size="sm"
                placeholder="e.g. Gaming News"
                value={brandingDisplayName}
                onChange={(e) => onBrandingDisplayNameChange(e.target.value)}
                opacity={isBrandingDisabled ? 0.6 : undefined}
                aria-describedby={isBrandingDisabled ? "branding-disabled-reason" : undefined}
              />
            </Field>
            <Field flex={1} minW="150px" disabled={isBrandingDisabled}>
              <chakra.label htmlFor="branding-avatar-url" fontSize="xs" color="fg.muted" mb={1}>
                Avatar URL
              </chakra.label>
              <Input
                id="branding-avatar-url"
                size="sm"
                placeholder="https://example.com/avatar.png"
                value={brandingAvatarUrl}
                onChange={(e) => onBrandingAvatarUrlChange(e.target.value)}
                opacity={isBrandingDisabled ? 0.6 : undefined}
                aria-describedby={isBrandingDisabled ? "branding-disabled-reason" : undefined}
              />
            </Field>
          </HStack>
        </Panel>
      )}
      {showComparisonPreview && (
        <VStack gap={4} align="stretch">
          <Box>
            <Text fontSize="sm" fontWeight="semibold" color="fg.muted" mb={2}>
              Current Format
            </Text>
            {isCurrentFormatLoading && <Skeleton height="200px" borderRadius="l3" />}
            {!isCurrentFormatLoading && isCurrentFormatError && (
              <Alert status="error" title="Failed to load current format preview." />
            )}
            {!isCurrentFormatLoading &&
              !isCurrentFormatError &&
              currentFormatMessages.length > 0 && (
                <DiscordMessageDisplay
                  messages={currentFormatMessages}
                  maxHeight={{ base: 250, lg: 200 }}
                  username={brandingDisplayName || undefined}
                  avatarUrl={resolvedAvatarUrl}
                  showVerifiedInAppBadge={!hasBrandingValues}
                />
              )}
            {!isCurrentFormatLoading &&
              !isCurrentFormatError &&
              currentFormatMessages.length === 0 && (
                <PreviewPlaceholder>No current format to display</PreviewPlaceholder>
              )}
          </Box>
          <Box>
            <Text fontSize="sm" fontWeight="semibold" color="fg.muted" mb={2}>
              Template Preview
            </Text>
            {!selectedTemplateId && (
              <PreviewPlaceholder>Select a template to compare</PreviewPlaceholder>
            )}
            {selectedTemplateId && isActuallyLoading && (
              <Skeleton height="200px" borderRadius="l3" />
            )}
            {selectedTemplateId && !isActuallyLoading && isPreviewError && (
              <Alert status="error" title="Failed to load template preview." />
            )}
            {selectedTemplateId &&
              !isActuallyLoading &&
              !isPreviewError &&
              previewMessages.length > 0 && (
                <>
                  <DiscordMessageDisplay
                    messages={previewMessages}
                    maxHeight={{ base: 250, lg: 200 }}
                    username={brandingDisplayName || undefined}
                    avatarUrl={resolvedAvatarUrl}
                    showVerifiedInAppBadge={!hasBrandingValues}
                  />
                  {showUnfurlNote && <DiscordUnfurlNote />}
                </>
              )}
            {selectedTemplateId &&
              !isActuallyLoading &&
              !isPreviewError &&
              previewMessages.length === 0 && (
                <PreviewPlaceholder>
                  There are currently no articles in the feed to preview. You can save now -
                  previews will be available once articles arrive.
                </PreviewPlaceholder>
              )}
          </Box>
          <Text fontSize="sm" color="fg.muted" mt={2}>
            These are approximate previews. Send to Discord to see the actual representation.
          </Text>
        </VStack>
      )}
      {!showComparisonPreview && (
        <Box>
          <Text fontSize="sm" color="fg.muted" mb={3}>
            Preview
          </Text>
          {!selectedTemplateId && (
            <PreviewPlaceholder>Select a template to preview</PreviewPlaceholder>
          )}
          {selectedTemplateId && isActuallyLoading && (
            <Skeleton height="300px" borderRadius="l3" aria-label="Loading preview" />
          )}
          {selectedTemplateId && !isActuallyLoading && isPreviewError && (
            <Alert status="error" title="Failed to load preview. Please try again." />
          )}
          {selectedTemplateId &&
            !isActuallyLoading &&
            !isPreviewError &&
            previewMessages.length > 0 && (
              <>
                <DiscordMessageDisplay
                  messages={previewMessages}
                  maxHeight={{ base: 300, lg: 350 }}
                  username={brandingDisplayName || undefined}
                  avatarUrl={resolvedAvatarUrl}
                  showVerifiedInAppBadge={!hasBrandingValues}
                />
                {showUnfurlNote && <DiscordUnfurlNote />}
              </>
            )}
          {selectedTemplateId &&
            !isActuallyLoading &&
            !isPreviewError &&
            previewMessages.length === 0 &&
            articles.length === 0 && (
              <Text color="fg.subtle" textAlign="center" py={8}>
                There are currently no articles in the feed to preview. You can save now - previews
                will be available once articles arrive.
              </Text>
            )}
          {!!articles.length && !showUnfurlNote && (
            <Text fontSize="sm" color="fg.muted" mt={2}>
              This is an approximate preview. Send to Discord to see the actual representation.
            </Text>
          )}
        </Box>
      )}
      {onTestSend && hasArticles && (
        <Box mt={4}>
          <SafeLoadingButton
            variant="outline"
            size="sm"
            onClick={() =>
              onTestSend?.({
                name: brandingDisplayName,
                iconUrl: brandingAvatarUrl || undefined,
              })
            }
            loading={isTestSendLoading}
            disabled={!canTestSend}
          >
            <FaDiscord />
            {isTestSendLoading ? "Sending..." : "Send to Discord"}
          </SafeLoadingButton>
        </Box>
      )}
      {testSendFeedback && !testSendFeedback.deliveryStatus && (
        <Box mt={3}>
          {testSendFeedback.status === "success" && (
            <Alert status="success" size="sm" title={testSendFeedback.message} />
          )}
          {testSendFeedback.status === "error" && (
            <Alert status="error" size="sm" title={testSendFeedback.message} />
          )}
        </Box>
      )}
    </Panel>
  );
};
