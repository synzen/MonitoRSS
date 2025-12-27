import React, { useState, useEffect, useRef, ReactNode } from "react";
import { FaDiscord } from "react-icons/fa";
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
  Grid,
  GridItem,
  SimpleGrid,
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
import { Template, TestSendFeedback } from "../../types";
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

export interface Article {
  id: string;
  title?: string;
  [key: string]: unknown;
}

export interface TemplateGalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
  templates: Template[];
  selectedTemplateId?: string;
  onTemplateSelect: (templateId: string) => void;
  feedFields: string[];
  articles: Article[];
  selectedArticleId?: string;
  onArticleChange: (articleId: string) => void;
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
  stepIndicator?: ReactNode;
  onTestSend?: () => void;
  isTestSendLoading?: boolean;
  testSendFeedback?: TestSendFeedback | null;
  onClearTestSendFeedback?: () => void;
  onSave?: () => void;
  isSaveLoading?: boolean;
}

export function isTemplateCompatible(template: Template, feedFields: string[]): boolean {
  if (!template.requiredFields || template.requiredFields.length === 0) {
    return true;
  }

  return template.requiredFields.every((field) => feedFields.includes(field));
}

export function getMissingFields(template: Template, feedFields: string[]): string[] {
  if (!template.requiredFields || template.requiredFields.length === 0) {
    return [];
  }

  return template.requiredFields.filter((field) => !feedFields.includes(field));
}

export function getDisabledReason(template: Template, feedFields: string[]): string {
  const missingFields = getMissingFields(template, feedFields);

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
  enabled: boolean;
}

const useTemplatePreview = ({
  template,
  articleId,
  feedId,
  connectionId,
  userFeed,
  connection,
  enabled,
}: UseTemplatePreviewParams) => {
  return useQuery({
    queryKey: ["template-preview", template?.id, articleId, feedId, connectionId],
    queryFn: async () => {
      if (!template || !articleId) {
        return null;
      }

      // If we have a connectionId, use the existing connection preview endpoint
      if (connectionId && userFeed && connection) {
        const previewInputData = convertMessageBuilderStateToConnectionPreviewInput(
          userFeed,
          connection,
          template.messageComponent
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
      const previewInputData = convertTemplateMessageComponentToPreviewInput(
        template.messageComponent
      );

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

const TemplateGalleryModalComponent = (props: TemplateGalleryModalProps) => {
  const {
    isOpen,
    onClose,
    templates,
    selectedTemplateId,
    onTemplateSelect,
    feedFields,
    articles,
    selectedArticleId,
    onArticleChange,
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
    stepIndicator,
    onTestSend,
    isTestSendLoading,
    testSendFeedback,
    onClearTestSendFeedback,
    onSave,
    isSaveLoading,
  } = props;

  const hasArticles = articles.length > 0;
  const canTestSend = hasArticles && !!selectedTemplateId && !!selectedArticleId;

  const { getRootProps, getRadioProps } = useRadioGroup({
    name: "template-selection",
    value: selectedTemplateId,
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
    enabled: isOpen && !!selectedTemplateId && !!selectedArticleId,
  });

  const hasNoFeedFields = feedFields.length === 0;

  const previewMessages = previewData?.result?.messages || [];

  // Only show loading when query is actually fetching, not when disabled
  const isActuallyLoading = fetchStatus === "fetching";

  // Track previous loading state to detect transition from loading to loaded
  const wasLoadingRef = useRef(false);
  const [previewAnnouncement, setPreviewAnnouncement] = useState("");

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

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size={{ base: "full", md: "xl", lg: "6xl" }}
      isCentered
      scrollBehavior="inside"
      closeOnOverlayClick
      closeOnEsc
    >
      <ModalOverlay />
      <ModalContent
        bg="gray.800"
        maxH={{ base: "100vh", lg: "90vh" }}
        data-testid={testId}
        aria-labelledby="template-gallery-modal-header"
      >
        <ModalHeader id="template-gallery-modal-header" color="white">
          Choose a Template
        </ModalHeader>
        <ModalCloseButton color="white" />
        <ModalBody>
          {testSendFeedback?.status === "error" && testSendFeedback.deliveryStatus ? (
            <TestSendErrorPanel
              feedback={testSendFeedback}
              onTryAnother={onClearTestSendFeedback || (() => {})}
              onUseAnyway={onSave || (() => {})}
              isUseAnywayLoading={isSaveLoading}
            />
          ) : (
            <>
              {stepIndicator && <Box mb={4}>{stepIndicator}</Box>}
              {hasNoFeedFields && (
                <Alert status="info" mb={4} borderRadius="md">
                  <AlertIcon />
                  Some templates are unavailable until your feed has articles
                </Alert>
              )}
              <Grid templateColumns={{ base: "1fr", lg: "1fr 400px" }} gap={6}>
                <GridItem>
                  <Box as="fieldset">
                    <VisuallyHidden as="legend">Choose a template</VisuallyHidden>
                    <SimpleGrid
                      {...getRootProps()}
                      columns={{ base: 1, md: 2, lg: 3 }}
                      spacing={4}
                    >
                      {templates.map((template) => {
                        const isCompatible = isTemplateCompatible(template, feedFields);
                        const disabledReason = getDisabledReason(template, feedFields);
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
                    </SimpleGrid>
                  </Box>
                </GridItem>
                <GridItem>
                  <Box
                    bg="gray.900"
                    borderRadius="md"
                    p={4}
                    minH={{ base: "200px", lg: "400px" }}
                    role="region"
                    aria-label="Template preview"
                    aria-busy={isActuallyLoading}
                  >
                    <Text fontSize="sm" color="gray.400" mb={3}>
                      Preview
                    </Text>
                    {articles.length > 0 && (
                      <FormControl mb={4}>
                        <FormLabel
                          htmlFor="article-selector"
                          fontSize="xs"
                          color="gray.400"
                          mb={1}
                        >
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
                    <Box>
                      {isActuallyLoading && <Skeleton height="300px" borderRadius="md" />}
                      {!isActuallyLoading && isPreviewError && (
                        <Alert status="error" borderRadius="md">
                          <AlertIcon />
                          Failed to load preview. Please try again.
                        </Alert>
                      )}
                      {!isActuallyLoading && !isPreviewError && previewMessages.length > 0 && (
                        <DiscordMessageDisplay
                          messages={previewMessages}
                          maxHeight={{ base: 200, lg: 350 }}
                        />
                      )}
                      {!isActuallyLoading &&
                        !isPreviewError &&
                        previewMessages.length === 0 &&
                        !selectedTemplateId && (
                          <Text color="gray.500" textAlign="center" py={8}>
                            Select a template to preview
                          </Text>
                        )}
                      {!isActuallyLoading &&
                        !isPreviewError &&
                        previewMessages.length === 0 &&
                        selectedTemplateId &&
                        articles.length > 0 && (
                          <Text color="gray.500" textAlign="center" py={8}>
                            Loading preview...
                          </Text>
                        )}
                      {!isActuallyLoading &&
                        !isPreviewError &&
                        previewMessages.length === 0 &&
                        articles.length === 0 && (
                          <Text color="gray.500" textAlign="center" py={8}>
                            Preview will appear when your feed has articles
                          </Text>
                        )}
                    </Box>
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
                            <HStack justifyContent="space-between" flex={1}>
                              <AlertDescription>{testSendFeedback.message}</AlertDescription>
                              <Button size="sm" variant="outline" onClick={onTestSend}>
                                Retry
                              </Button>
                            </HStack>
                          </Alert>
                        )}
                      </Box>
                    )}
                  </Box>
                </GridItem>
              </Grid>
              <VisuallyHidden>
                <div aria-live="polite" aria-atomic="true">
                  {previewAnnouncement}
                </div>
              </VisuallyHidden>
            </>
          )}
        </ModalBody>
        {/* Hide footer when error panel is showing - error panel has its own action buttons */}
        {!(testSendFeedback?.status === "error" && testSendFeedback.deliveryStatus) && (
          <ModalFooter>
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
                  <Button variant="ghost" onClick={onSecondaryAction || onClose}>
                    {secondaryActionLabel}
                  </Button>
                  <Button
                    colorScheme="blue"
                    onClick={onSave}
                    isLoading={isSaveLoading}
                    isDisabled={!selectedTemplateId}
                  >
                    Save
                  </Button>
                </HStack>
              </HStack>
            ) : (
              <>
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
                    isDisabled={!selectedTemplateId}
                    onClick={() => selectedTemplateId && onPrimaryAction(selectedTemplateId)}
                  >
                    {primaryActionLabel}
                  </Button>
                )}
              </>
            )}
          </ModalFooter>
        )}
      </ModalContent>
    </Modal>
  );
};

export const TemplateGalleryModal = React.memo(TemplateGalleryModalComponent);
TemplateGalleryModal.displayName = "TemplateGalleryModal";
