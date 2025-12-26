import React from "react";
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
  VisuallyHidden,
  useRadioGroup,
  FormControl,
  FormLabel,
} from "@chakra-ui/react";
import { useQuery } from "@tanstack/react-query";
import { TemplateCard } from "../TemplateCard";
import { DiscordMessageDisplay } from "../../../../components/DiscordMessageDisplay";
import { Template } from "../../types";
import {
  CreateDiscordChannelConnectionPreviewInput,
  createDiscordChannelConnectionPreview,
} from "../../../feedConnections/api";
import convertMessageBuilderStateToConnectionPreviewInput from "../../../../pages/MessageBuilder/utils/convertMessageBuilderStateToConnectionPreviewInput";
import { UserFeed } from "../../../feed";
import { FeedDiscordChannelConnection } from "../../../../types";

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
}

export function isTemplateCompatible(template: Template, feedFields: string[]): boolean {
  if (!template.requiredFields || template.requiredFields.length === 0) {
    return true;
  }

  return template.requiredFields.every((field) => feedFields.includes(field));
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
      if (!template || !articleId || !connectionId || !userFeed || !connection) {
        return null;
      }

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

      const result = await createDiscordChannelConnectionPreview(input);

      return result;
    },
    enabled: enabled && !!template && !!articleId && !!connectionId && !!userFeed && !!connection,
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
  } = props;

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
                <SimpleGrid {...getRootProps()} columns={{ base: 1, md: 2, lg: 3 }} spacing={4}>
                  {templates.map((template) => {
                    const isCompatible = isTemplateCompatible(template, feedFields);
                    const radio = getRadioProps({
                      value: template.id,
                    });

                    return (
                      <TemplateCard
                        key={template.id}
                        template={template}
                        disabledReason="Needs articles"
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
                aria-label="Template preview"
                aria-busy={isActuallyLoading}
              >
                <Text fontSize="sm" color="gray.400" mb={3}>
                  Preview
                </Text>
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
                <Box aria-live="polite">
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
                    !connectionId && (
                      <Text color="gray.500" textAlign="center" py={8}>
                        Preview requires a connection
                      </Text>
                    )}
                </Box>
              </Box>
            </GridItem>
          </Grid>
        </ModalBody>
        <ModalFooter>
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
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export const TemplateGalleryModal = React.memo(TemplateGalleryModalComponent);
TemplateGalleryModal.displayName = "TemplateGalleryModal";
