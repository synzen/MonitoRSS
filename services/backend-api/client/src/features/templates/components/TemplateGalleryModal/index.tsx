import React, { useState, useEffect, useRef } from "react";
import { FaDiscord } from "react-icons/fa";
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
  VStack,
  Box,
  Button,
  Skeleton,
  Text,
  Select,
  Alert,
  AlertIcon,
  AlertDescription,
  VisuallyHidden,
  useRadioGroup,
  FormControl,
  FormLabel,
  HStack,
} from "@chakra-ui/react";
import { useQuery } from "@tanstack/react-query";
import { TemplateCard } from "../TemplateCard";
import { DiscordMessageDisplay } from "../../../../components/DiscordMessageDisplay";
import { InlineErrorAlert } from "../../../../components/InlineErrorAlert";
import { TemplateGalleryLoadingSkeleton } from "./TemplateGalleryLoadingSkeleton";
import { DetectedFields, Template, TestSendFeedback } from "../../types";
import { TestSendErrorPanel } from "../TestSendErrorPanel";
import {
  CreateDiscordChannelConnectionPreviewInput,
  createDiscordChannelConnectionPreview,
  createTemplatePreview,
  CreateTemplatePreviewInput,
} from "../../../feedConnections/api";
import convertMessageBuilderStateToConnectionPreviewInput from "../../../../pages/MessageBuilder/utils/convertMessageBuilderStateToConnectionPreviewInput";
import { UserFeed } from "../../../feed";
import { FeedDiscordChannelConnection } from "../../../../types";
import { convertTemplateMessageComponentToPreviewInput } from "./templatePreviewUtils";
import { TemplateGalleryLayout } from "./TemplateGalleryLayout";
import { MessageComponentRoot } from "../../../../pages/MessageBuilder/types";

const TEMPLATE_GALLERY_HELPER_TEXT =
  "Pick a starting point for your message layout. You can customize everything after applying.";

export interface Article {
  id: string;
  title?: string;
  [key: string]: unknown;
}

export interface TemplateGalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCancel?: () => void;
  templates: Template[];
  selectedTemplateId?: string;
  onTemplateSelect: (templateId: string) => void;
  feedFields: string[];
  detectedFields: DetectedFields;
  articles: Article[];
  selectedArticleId?: string;
  onArticleChange: (articleId: string) => void;
  isLoadingArticles?: boolean;
  connectionId?: string;
  feedId: string;
  userFeed?: UserFeed;
  connection?: FeedDiscordChannelConnection;
  primaryActionLabel?: string;
  onPrimaryAction?: (selectedTemplateId: string) => void;
  isPrimaryActionLoading?: boolean;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  tertiaryActionLabel?: string;
  onTertiaryAction?: () => void;
  testId?: string;
  onTestSend?: () => void;
  isTestSendLoading?: boolean;
  testSendFeedback?: TestSendFeedback | null;
  onClearTestSendFeedback?: () => void;
  onSave?: () => void;
  isSaveLoading?: boolean;
  saveError?: { message: string } | null;
  // Message builder context props
  modalTitle?: string;
  showComparisonPreview?: boolean;
  currentMessageComponent?: MessageComponentRoot;
  finalFocusRef?: React.RefObject<HTMLElement>;
}

export function isTemplateCompatible(
  template: Template,
  feedFields: string[],
  detectedFields: DetectedFields
): boolean {
  const andFieldsSatisfied =
    !template.requiredFields?.length ||
    template.requiredFields.every((field) => {
      return detectedFields[field].length > 0 || feedFields.includes(field);
    });

  const orFieldsSatisfied =
    !template.requiredFieldsOr?.length ||
    template.requiredFieldsOr.some((field) => {
      return detectedFields[field].length > 0 || feedFields.includes(field);
    });

  return andFieldsSatisfied && orFieldsSatisfied;
}

export function getMissingFields(
  template: Template,
  feedFields: string[],
  detectedFields: DetectedFields
): string[] {
  const missingAndFields = (template.requiredFields ?? []).filter((field) => {
    return detectedFields[field].length === 0 && !feedFields.includes(field);
  });

  const orFields = template.requiredFieldsOr ?? [];
  const orSatisfied =
    orFields.length === 0 ||
    orFields.some((field) => detectedFields[field].length > 0 || feedFields.includes(field));

  if (!orSatisfied) {
    return [...missingAndFields, orFields.join(" or ")];
  }

  return missingAndFields;
}

export function getDisabledReason(
  template: Template,
  feedFields: string[],
  detectedFields: DetectedFields
): string {
  const missingFields = getMissingFields(template, feedFields, detectedFields);

  if (missingFields.length === 0) {
    return "";
  }

  // If feedFields is empty (no articles), use generic message per spec
  if (feedFields.length === 0) {
    return "Needs articles";
  }

  // If articles exist but specific fields are missing, show which fields
  return `Needs: ${missingFields.join(", ")}`;
}

interface UseTemplatePreviewParams {
  template: Template | undefined;
  articleId: string | undefined;
  feedId: string;
  connectionId?: string;
  userFeed?: UserFeed;
  connection?: FeedDiscordChannelConnection;
  detectedFields: DetectedFields;
  enabled: boolean;
}

const useTemplatePreview = ({
  template,
  articleId,
  feedId,
  connectionId,
  userFeed,
  connection,
  detectedFields,
  enabled,
}: UseTemplatePreviewParams) => {
  return useQuery({
    queryKey: ["template-preview", template?.id, articleId, feedId, connectionId],
    queryFn: async () => {
      if (!template || !articleId) {
        return null;
      }

      // Create message component with detected fields
      const messageComponent = template.createMessageComponent(detectedFields);

      // If we have a connectionId, use the existing connection preview endpoint
      if (connectionId && userFeed && connection) {
        const previewInputData = convertMessageBuilderStateToConnectionPreviewInput(
          userFeed,
          connection,
          messageComponent
        );

        const input: CreateDiscordChannelConnectionPreviewInput = {
          feedId,
          connectionId,
          data: {
            article: { id: articleId },
            ...previewInputData,
          },
        };

        return createDiscordChannelConnectionPreview(input);
      }

      // Otherwise, use the template preview endpoint (no connection required)
      const previewInputData = convertTemplateMessageComponentToPreviewInput(messageComponent);

      const input: CreateTemplatePreviewInput = {
        feedId,
        data: {
          article: { id: articleId },
          ...previewInputData,
        },
      };

      return createTemplatePreview(input);
    },
    enabled: enabled && !!template && !!articleId && !!feedId,
    staleTime: 30000,
  });
};

interface UseCurrentFormatPreviewParams {
  currentMessageComponent?: MessageComponentRoot;
  articleId?: string;
  feedId: string;
  connectionId?: string;
  userFeed?: UserFeed;
  connection?: FeedDiscordChannelConnection;
  enabled: boolean;
}

const useCurrentFormatPreview = ({
  currentMessageComponent,
  articleId,
  feedId,
  connectionId,
  userFeed,
  connection,
  enabled,
}: UseCurrentFormatPreviewParams) => {
  return useQuery({
    queryKey: ["current-format-preview", articleId, feedId, connectionId],
    queryFn: async () => {
      if (!currentMessageComponent || !articleId || !connectionId || !userFeed || !connection) {
        return null;
      }

      const previewInputData = convertMessageBuilderStateToConnectionPreviewInput(
        userFeed,
        connection,
        currentMessageComponent
      );

      const input: CreateDiscordChannelConnectionPreviewInput = {
        feedId,
        connectionId,
        data: {
          article: { id: articleId },
          ...previewInputData,
        },
      };

      return createDiscordChannelConnectionPreview(input);
    },
    enabled: enabled && !!currentMessageComponent && !!articleId && !!connectionId,
    staleTime: 30000,
  });
};

const TemplateGalleryModalComponent = (props: TemplateGalleryModalProps) => {
  const {
    isOpen,
    onClose,
    onCancel,
    templates,
    selectedTemplateId,
    onTemplateSelect,
    feedFields,
    detectedFields,
    articles,
    selectedArticleId,
    onArticleChange,
    isLoadingArticles,
    feedId,
    connectionId,
    userFeed,
    connection,
    primaryActionLabel = "Use this template",
    onPrimaryAction,
    isPrimaryActionLoading,
    secondaryActionLabel = "Cancel",
    onSecondaryAction,
    tertiaryActionLabel,
    onTertiaryAction,
    testId,
    onTestSend,
    isTestSendLoading,
    testSendFeedback,
    onClearTestSendFeedback,
    onSave,
    isSaveLoading,
    saveError,
    modalTitle,
    showComparisonPreview,
    currentMessageComponent,
    finalFocusRef,
  } = props;

  const hasArticles = articles.length > 0;
  const canTestSend = hasArticles && !!selectedTemplateId && !!selectedArticleId;

  // Validation error for template selection
  const [showTemplateError, setShowTemplateError] = useState(false);

  // Clear error when template is selected
  useEffect(() => {
    if (selectedTemplateId) {
      setShowTemplateError(false);
    }
  }, [selectedTemplateId]);

  // Reset error when modal closes
  useEffect(() => {
    if (!isOpen) {
      setShowTemplateError(false);
    }
  }, [isOpen]);

  const { getRootProps, getRadioProps } = useRadioGroup({
    name: "template-selection",
    value: selectedTemplateId || "",
    onChange: onTemplateSelect,
  });

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);

  const {
    data: previewData,
    isError: isPreviewError,
    fetchStatus,
  } = useTemplatePreview({
    template: selectedTemplate,
    articleId: selectedArticleId,
    feedId,
    connectionId,
    userFeed,
    connection,
    detectedFields,
    enabled: isOpen && !!selectedTemplateId && !!selectedArticleId,
  });

  // Current format preview (for dual preview mode)
  const {
    data: currentFormatData,
    isError: isCurrentFormatError,
    fetchStatus: currentFormatFetchStatus,
  } = useCurrentFormatPreview({
    currentMessageComponent,
    articleId: selectedArticleId,
    feedId,
    connectionId,
    userFeed,
    connection,
    enabled: isOpen && showComparisonPreview === true && !!selectedArticleId,
  });

  const currentFormatMessages = currentFormatData?.result?.messages || [];
  const isCurrentFormatLoading = currentFormatFetchStatus === "fetching";

  const hasNoFeedFields = feedFields.length === 0;

  const previewMessages = previewData?.result?.messages || [];

  // Only show loading when query is actually fetching, not when disabled
  const isActuallyLoading = fetchStatus === "fetching";

  // Track previous loading state to detect transition from loading to loaded
  const wasLoadingRef = useRef(false);
  const [previewAnnouncement, setPreviewAnnouncement] = useState("");
  const saveErrorRef = useRef<HTMLDivElement>(null);

  // Announce when preview finishes loading for a template
  useEffect(() => {
    if (wasLoadingRef.current && !isActuallyLoading && previewData && selectedTemplateId) {
      const template = templates.find((t) => t.id === selectedTemplateId);

      if (template) {
        setPreviewAnnouncement(`Preview updated for ${template.name} template`);
        const timer = setTimeout(() => setPreviewAnnouncement(""), 1000);

        return () => clearTimeout(timer);
      }
    }

    wasLoadingRef.current = isActuallyLoading;

    return () => {};
  }, [isActuallyLoading, previewData, selectedTemplateId, templates]);

  // Scroll to save error when it appears
  useEffect(() => {
    if (saveError && saveErrorRef.current) {
      saveErrorRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [saveError]);

  const showErrorPanel = testSendFeedback?.status === "error" && testSendFeedback.deliveryStatus;

  // Handle primary action with validation
  const handlePrimaryAction = () => {
    if (!selectedTemplateId) {
      setShowTemplateError(true);

      return;
    }

    if (onPrimaryAction) {
      onPrimaryAction(selectedTemplateId);
    }
  };

  // Handle save action with validation
  const handleSave = () => {
    if (!selectedTemplateId) {
      setShowTemplateError(true);

      return;
    }

    if (onSave) {
      onSave();
    }
  };

  const renderModalBodyContent = () => {
    if (showErrorPanel) {
      return (
        <TestSendErrorPanel
          feedback={testSendFeedback}
          onTryAnother={onClearTestSendFeedback || (() => {})}
          onUseAnyway={onSave || (() => {})}
          isUseAnywayLoading={isSaveLoading}
        />
      );
    }

    if (isLoadingArticles) {
      return (
        <>
          <Text color="gray.400" mb={4}>
            {TEMPLATE_GALLERY_HELPER_TEXT}
          </Text>
          <TemplateGalleryLoadingSkeleton />
        </>
      );
    }

    return (
      <>
        <Text color="gray.400" mb={4}>
          {TEMPLATE_GALLERY_HELPER_TEXT}
        </Text>
        {hasNoFeedFields && (
          <Alert status="info" mb={4} borderRadius="md">
            <AlertIcon />
            Your feed has no articles yet. You can proceed with Simple Text now, or wait for
            articles to unlock more template options.
          </Alert>
        )}
        <TemplateGalleryLayout
          templateList={
            <Box as="fieldset">
              <VisuallyHidden as="legend">Choose a template</VisuallyHidden>
              <VStack {...getRootProps()} spacing={3} align="stretch" p={1}>
                {[...templates]
                  .sort((a, b) => {
                    const aCompatible = isTemplateCompatible(a, feedFields, detectedFields);
                    const bCompatible = isTemplateCompatible(b, feedFields, detectedFields);

                    if (aCompatible && !bCompatible) return -1;
                    if (!aCompatible && bCompatible) return 1;

                    return 0;
                  })
                  .map((template) => {
                    const isCompatible = isTemplateCompatible(template, feedFields, detectedFields);
                    const disabledReason = getDisabledReason(template, feedFields, detectedFields);
                    const radio = getRadioProps({
                      value: template.id,
                    });

                    return (
                      <TemplateCard
                        key={template.id}
                        template={template}
                        disabledReason={disabledReason}
                        isDisabled={!isCompatible}
                        {...radio}
                      />
                    );
                  })}
              </VStack>
            </Box>
          }
          preview={
            <Box
              bg="gray.900"
              borderRadius="md"
              p={4}
              minH={{ base: "200px", lg: "400px" }}
              role="region"
              aria-label="Template preview"
              aria-busy={isActuallyLoading || isCurrentFormatLoading}
            >
              {/* Article Selector - shared between both previews */}
              {articles.length > 0 && (
                <FormControl mb={4}>
                  <FormLabel htmlFor="article-selector" fontSize="xs" color="gray.400" mb={1}>
                    Preview article
                  </FormLabel>
                  <Select
                    id="article-selector"
                    value={selectedArticleId || ""}
                    onChange={(e) => onArticleChange(e.target.value)}
                    bg="gray.700"
                    borderColor="gray.600"
                    size="sm"
                    color="white"
                    _hover={{ borderColor: "gray.500" }}
                  >
                    {articles.map((article) => (
                      <option
                        key={article.id}
                        value={article.id}
                        style={{ backgroundColor: "#2D3748" }}
                      >
                        {article.title || article.id}
                      </option>
                    ))}
                  </Select>
                </FormControl>
              )}
              {/* Dual Preview Mode */}
              {showComparisonPreview && (
                <VStack spacing={4} align="stretch">
                  {/* Current Format Preview */}
                  <Box>
                    <Text fontSize="sm" fontWeight="semibold" color="gray.400" mb={2}>
                      Current Format
                    </Text>
                    {isCurrentFormatLoading && <Skeleton height="200px" borderRadius="md" />}
                    {!isCurrentFormatLoading && isCurrentFormatError && (
                      <Alert status="error" borderRadius="md">
                        <AlertIcon />
                        Failed to load current format preview.
                      </Alert>
                    )}
                    {!isCurrentFormatLoading &&
                      !isCurrentFormatError &&
                      currentFormatMessages.length > 0 && (
                        <DiscordMessageDisplay messages={currentFormatMessages} maxHeight={200} />
                      )}
                    {!isCurrentFormatLoading &&
                      !isCurrentFormatError &&
                      currentFormatMessages.length === 0 && (
                        <Box
                          p={8}
                          textAlign="center"
                          bg="gray.800"
                          borderRadius="md"
                          color="gray.500"
                        >
                          No current format to display
                        </Box>
                      )}
                  </Box>
                  {/* Template Preview */}
                  <Box>
                    <Text fontSize="sm" fontWeight="semibold" color="gray.400" mb={2}>
                      Template Preview
                    </Text>
                    {!selectedTemplateId && (
                      <Box
                        p={8}
                        textAlign="center"
                        bg="gray.800"
                        borderRadius="md"
                        color="gray.500"
                      >
                        Select a template to compare
                      </Box>
                    )}
                    {selectedTemplateId && isActuallyLoading && (
                      <Skeleton height="200px" borderRadius="md" />
                    )}
                    {selectedTemplateId && !isActuallyLoading && isPreviewError && (
                      <Alert status="error" borderRadius="md">
                        <AlertIcon />
                        Failed to load template preview.
                      </Alert>
                    )}
                    {selectedTemplateId &&
                      !isActuallyLoading &&
                      !isPreviewError &&
                      previewMessages.length > 0 && (
                        <DiscordMessageDisplay messages={previewMessages} maxHeight={200} />
                      )}
                    {selectedTemplateId &&
                      !isActuallyLoading &&
                      !isPreviewError &&
                      previewMessages.length === 0 && (
                        <Box
                          p={8}
                          textAlign="center"
                          bg="gray.800"
                          borderRadius="md"
                          color="gray.500"
                        >
                          There are currently no articles in the feed to preview. You can save now -
                          previews will be available once articles arrive.
                        </Box>
                      )}
                  </Box>
                  <Text fontSize="sm" color="gray.400" mt={2}>
                    These are approximate previews. Send to Discord to see the actual
                    representation.
                  </Text>
                </VStack>
              )}
              {/* Single Preview Mode (original behavior) */}
              {!showComparisonPreview && (
                <Box>
                  <Text fontSize="sm" color="gray.400" mb={3}>
                    Preview
                  </Text>
                  {/* No template selected - show placeholder */}
                  {!selectedTemplateId && (
                    <Box p={8} textAlign="center" bg="gray.800" borderRadius="md" color="gray.500">
                      Select a template to preview
                    </Box>
                  )}
                  {selectedTemplateId && isActuallyLoading && (
                    <Skeleton height="300px" borderRadius="md" aria-label="Loading preview" />
                  )}
                  {selectedTemplateId && !isActuallyLoading && isPreviewError && (
                    <Alert status="error" borderRadius="md">
                      <AlertIcon />
                      Failed to load preview. Please try again.
                    </Alert>
                  )}
                  {selectedTemplateId &&
                    !isActuallyLoading &&
                    !isPreviewError &&
                    previewMessages.length > 0 && (
                      <DiscordMessageDisplay
                        messages={previewMessages}
                        maxHeight={{ base: 200, lg: 350 }}
                      />
                    )}
                  {selectedTemplateId &&
                    !isActuallyLoading &&
                    !isPreviewError &&
                    previewMessages.length === 0 &&
                    articles.length === 0 && (
                      <Text color="gray.500" textAlign="center" py={8}>
                        There are currently no articles in the feed to preview. You can save now -
                        previews will be available once articles arrive.
                      </Text>
                    )}
                  {!!articles.length && (
                    <Text fontSize="sm" color="gray.400" mt={2}>
                      This is an approximate preview. Send to Discord to see the actual
                      representation.
                    </Text>
                  )}
                </Box>
              )}
              {onTestSend && hasArticles && (
                <Box mt={4}>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onTestSend}
                    isLoading={isTestSendLoading}
                    isDisabled={!canTestSend}
                    aria-busy={isTestSendLoading}
                    leftIcon={<FaDiscord />}
                  >
                    {isTestSendLoading ? "Sending..." : "Send to Discord"}
                  </Button>
                </Box>
              )}
              {testSendFeedback && !testSendFeedback.deliveryStatus && (
                <Box mt={3}>
                  {testSendFeedback.status === "success" && (
                    <Alert status="success" borderRadius="md" size="sm">
                      <AlertIcon />
                      <AlertDescription>{testSendFeedback.message}</AlertDescription>
                    </Alert>
                  )}
                  {testSendFeedback.status === "error" && (
                    <Alert status="error" borderRadius="md" size="sm">
                      <AlertIcon />
                      <AlertDescription>{testSendFeedback.message}</AlertDescription>
                    </Alert>
                  )}
                </Box>
              )}
            </Box>
          }
        />
        <VisuallyHidden>
          <div aria-live="polite" aria-atomic="true">
            {previewAnnouncement}
          </div>
        </VisuallyHidden>
        {saveError && (
          <Box mt={4} ref={saveErrorRef}>
            <InlineErrorAlert title="Failed to save" description={saveError.message} />
          </Box>
        )}
      </>
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size={{ base: "full", md: "xl", lg: "6xl" }}
      scrollBehavior="inside"
      closeOnOverlayClick
      closeOnEsc
      finalFocusRef={finalFocusRef}
    >
      <ModalOverlay />
      <ModalContent
        maxH={{ base: "100dvh", lg: "90vh" }}
        height={{ base: "100dvh", md: "auto" }}
        data-testid={testId}
        aria-labelledby="template-gallery-modal-header"
      >
        <ModalHeader id="template-gallery-modal-header">
          {modalTitle || "Choose a Message Format Template"}
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody>{renderModalBodyContent()}</ModalBody>
        {/* Hide footer when error panel is showing - error panel has its own action buttons */}
        {!showErrorPanel && (
          <ModalFooter flexDirection="column" gap={3} alignItems="stretch">
            {showTemplateError && (
              <Alert status="error" borderRadius="md">
                <AlertIcon />
                <AlertDescription>Please select a template first.</AlertDescription>
              </Alert>
            )}
            {onTestSend ? (
              <HStack w="100%" justifyContent="space-between">
                <Button
                  variant="link"
                  colorScheme="gray"
                  onClick={onTertiaryAction}
                  color="gray.400"
                  _hover={{ color: "white" }}
                >
                  {tertiaryActionLabel}
                </Button>
                <HStack>
                  <Button variant="ghost" onClick={onCancel || onClose}>
                    Cancel
                  </Button>
                  <Button colorScheme="blue" onClick={handleSave} isLoading={isSaveLoading}>
                    Save
                  </Button>
                </HStack>
              </HStack>
            ) : (
              <HStack w="100%" justifyContent="flex-end">
                {tertiaryActionLabel && (
                  <Button
                    variant="link"
                    colorScheme="gray"
                    mr="auto"
                    onClick={onTertiaryAction}
                    color="gray.400"
                    _hover={{ color: "white" }}
                  >
                    {tertiaryActionLabel}
                  </Button>
                )}
                <Button variant="outline" mr={3} onClick={onSecondaryAction || onClose}>
                  {secondaryActionLabel}
                </Button>
                {onPrimaryAction && (
                  <Button
                    colorScheme="blue"
                    isLoading={isPrimaryActionLoading}
                    onClick={handlePrimaryAction}
                  >
                    {primaryActionLabel}
                  </Button>
                )}
              </HStack>
            )}
          </ModalFooter>
        )}
      </ModalContent>
    </Modal>
  );
};

export const TemplateGalleryModal = React.memo(TemplateGalleryModalComponent);
TemplateGalleryModal.displayName = "TemplateGalleryModal";
