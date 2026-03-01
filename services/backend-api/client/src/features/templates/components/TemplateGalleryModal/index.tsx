import React, { useState, useEffect, useRef, useContext } from "react";
import { FaDiscord } from "react-icons/fa";
import { CheckIcon, InfoIcon, LockIcon } from "@chakra-ui/icons";
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
  Input,
  Link as ChakraLink,
  Switch,
  Badge,
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
import { useIsFeatureAllowed } from "../../../../hooks";
import {
  BlockableFeature,
  PRICE_IDS,
  ProductKey,
  PRODUCT_NAMES,
  ProductFeature,
  TIER_CONFIGS,
} from "../../../../constants";
import { usePaddleContext } from "../../../../contexts/PaddleContext";
import { PricingDialogContext } from "../../../../contexts";

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
  onPrimaryAction?: (
    selectedTemplateId: string,
    branding?: { name: string; iconUrl?: string }
  ) => void;
  isPrimaryActionLoading?: boolean;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  tertiaryActionLabel?: string;
  onTertiaryAction?: () => void;
  testId?: string;
  onTestSend?: (branding?: { name: string; iconUrl?: string }) => void;
  isTestSendLoading?: boolean;
  testSendFeedback?: TestSendFeedback | null;
  onClearTestSendFeedback?: () => void;
  onSave?: (branding?: { name: string; iconUrl?: string }) => void;
  isSaveLoading?: boolean;
  saveError?: { message: string } | null;
  // Message builder context props
  modalTitle?: string;
  showComparisonPreview?: boolean;
  currentMessageComponent?: MessageComponentRoot;
  finalFocusRef?: React.RefObject<HTMLElement>;
  brandingDisabledReason?: string;
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
    brandingDisabledReason,
  } = props;

  const { allowed: webhooksAllowed } = useIsFeatureAllowed({
    feature: BlockableFeature.DiscordWebhooks,
  });
  const { openCheckout, isLoaded: isPaddleLoaded, getPricePreview } = usePaddleContext();
  const { onOpen: onOpenPricingDialog } = useContext(PricingDialogContext);

  const isBrandingDisabled = !!brandingDisabledReason;

  const [brandingDisplayName, setBrandingDisplayName] = useState("");
  const [brandingAvatarUrl, setBrandingAvatarUrl] = useState("");
  const hasBrandingValues = !isBrandingDisabled && !!brandingDisplayName.trim();

  const [billingInterval, setBillingInterval] = useState<"month" | "year">("month");
  const [tier1Prices, setTier1Prices] = useState<{
    month?: string;
    year?: string;
  }>({});
  const [isPriceLoading, setIsPriceLoading] = useState(false);
  const [isPaddleCheckoutOpen, setIsPaddleCheckoutOpen] = useState(false);

  const [modalView, setModalView] = useState<"editor" | "upgrade">("editor");
  const upgradeHeadingRef = useRef<HTMLParagraphElement>(null);
  const saveButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isBrandingDisabled) {
      setBrandingDisplayName("");
      setBrandingAvatarUrl("");
    }
  }, [isBrandingDisabled]);

  useEffect(() => {
    if (!isOpen) {
      setModalView("editor");
      setBrandingDisplayName("");
      setBrandingAvatarUrl("");
      setBillingInterval("month");
      setIsPaddleCheckoutOpen(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (modalView !== "upgrade" || !isPaddleLoaded) return;

    let cancelled = false;
    setIsPriceLoading(true);

    getPricePreview([
      { priceId: PRICE_IDS[ProductKey.Tier1].month, quantity: 1 },
      { priceId: PRICE_IDS[ProductKey.Tier1].year, quantity: 1 },
    ])
      .then((previews) => {
        if (cancelled) return;
        const tier1 = previews.find((p) => p.id === ProductKey.Tier1);

        if (tier1) {
          const monthPrice = tier1.prices.find((p) => p.interval === "month");
          const yearPrice = tier1.prices.find((p) => p.interval === "year");

          setTier1Prices({
            month: monthPrice?.formattedPrice,
            year: yearPrice?.formattedPrice,
          });
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setIsPriceLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [modalView, isPaddleLoaded]);

  useEffect(() => {
    if (modalView === "upgrade") {
      setTimeout(() => upgradeHeadingRef.current?.focus(), 0);
    } else if (modalView === "editor") {
      setTimeout(() => saveButtonRef.current?.focus(), 0);
    }
  }, [modalView]);

  const prevWebhooksAllowedRef = useRef(webhooksAllowed);
  useEffect(() => {
    if (!prevWebhooksAllowedRef.current && webhooksAllowed && modalView !== "editor") {
      setModalView("editor");
      setIsPaddleCheckoutOpen(false);
    }
    prevWebhooksAllowedRef.current = webhooksAllowed;
  }, [webhooksAllowed, modalView]);

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

    if (!webhooksAllowed && hasBrandingValues) {
      setModalView("upgrade");
      return;
    }

    if (onPrimaryAction) {
      onPrimaryAction(
        selectedTemplateId,
        isBrandingDisabled
          ? undefined
          : {
              name: brandingDisplayName,
              iconUrl: brandingAvatarUrl || undefined,
            }
      );
    }
  };

  // Handle save action with validation
  const handleSave = () => {
    if (!selectedTemplateId) {
      setShowTemplateError(true);

      return;
    }

    if (!webhooksAllowed && hasBrandingValues) {
      setModalView("upgrade");
      return;
    }

    if (onSave) {
      onSave(
        isBrandingDisabled
          ? undefined
          : {
              name: brandingDisplayName,
              iconUrl: brandingAvatarUrl || undefined,
            }
      );
    }
  };

  const renderUpgradePrompt = () => {
    return (
      <Box
        role="region"
        aria-label="Upgrade to save custom branding"
        p={8}
        textAlign="center"
        maxW="480px"
        mx="auto"
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        minH={{ lg: "400px" }}
      >
        {/* Value proposition */}
        <LockIcon boxSize={8} color="blue.300" mb={4} />
        <Text
          as="h3"
          ref={upgradeHeadingRef}
          tabIndex={-1}
          fontSize="lg"
          fontWeight="semibold"
          mb={2}
        >
          Custom branding is included on all paid plans
        </Text>
        <Text color="whiteAlpha.700" mb={5}>
          Deliver articles with your own name and avatar.
        </Text>
        <VStack as="ul" spacing={2} mb={6} alignItems="flex-start" listStyleType="none">
          {TIER_CONFIGS.find((t) => t.productId === ProductKey.Tier1)
            ?.features.filter(
              (f) =>
                f.name === ProductFeature.Webhooks ||
                f.name === ProductFeature.Feeds ||
                f.name === ProductFeature.RefreshRate
            )
            .map((feature) => (
              <HStack as="li" key={feature.name} spacing={2}>
                <CheckIcon boxSize={3} color="green.400" />
                <Text fontSize="sm" color="whiteAlpha.900">
                  {feature.description}
                </Text>
              </HStack>
            ))}
        </VStack>

        {/* Pricing */}
        <Box
          w="100%"
          bg="whiteAlpha.50"
          border="1px solid"
          borderColor="whiteAlpha.100"
          borderRadius="lg"
          p={5}
          mb={6}
          role="group"
          aria-label="Pricing options"
        >
          <HStack justifyContent="center" spacing={3} mb={2}>
            <Text fontSize="sm" fontWeight="semibold">
              Monthly
            </Text>
            <Switch
              size="md"
              colorScheme="green"
              isChecked={billingInterval === "year"}
              onChange={(e) => setBillingInterval(e.target.checked ? "year" : "month")}
              aria-label="Switch to yearly pricing"
            />
            <Text fontSize="sm" fontWeight="semibold">
              Yearly
            </Text>
          </HStack>
          <Badge colorScheme="green" borderRadius="md" px={2} mb={4}>
            Save 15% with yearly
          </Badge>
          <Box aria-live="polite" aria-atomic="true">
            {isPriceLoading ? (
              <Skeleton height="36px" width="160px" mx="auto" borderRadius="md" />
            ) : (
              <Text fontSize="3xl" fontWeight="bold">
                {tier1Prices[billingInterval] || "—"}
                <Text as="span" fontSize="lg" fontWeight="normal" color="whiteAlpha.700">
                  /{billingInterval === "month" ? "month" : "year"}
                </Text>
              </Text>
            )}
          </Box>
        </Box>

        {/* Action */}
        <Button
          colorScheme="blue"
          size="lg"
          mb={3}
          isDisabled={!isPaddleLoaded || isPriceLoading}
          onClick={() => {
            const priceId = PRICE_IDS[ProductKey.Tier1][billingInterval];
            setIsPaddleCheckoutOpen(true);
            openCheckout({
              prices: [{ priceId, quantity: 1 }],
              displayMode: "overlay",
            });
          }}
        >
          Get {PRODUCT_NAMES[ProductKey.Tier1]}
        </Button>
        <Box mb={4}>
          <ChakraLink
            fontSize="sm"
            color="whiteAlpha.700"
            onClick={() => setModalView("editor")}
            cursor="pointer"
          >
            Back to editor
          </ChakraLink>
        </Box>
        <Text fontSize="xs" color="whiteAlpha.700">
          By proceeding to payment, you agree to our{" "}
          <ChakraLink
            href="https://monitorss.xyz/terms"
            target="_blank"
            rel="noopener noreferrer"
            color="blue.300"
          >
            terms
          </ChakraLink>{" "}
          and{" "}
          <ChakraLink
            href="https://monitorss.xyz/privacy-policy"
            target="_blank"
            rel="noopener noreferrer"
            color="blue.300"
          >
            privacy policy
          </ChakraLink>
          . Payments handled by Paddle.com.
        </Text>
      </Box>
    );
  };

  const renderPreviewColumn = () => (
    <Box
      bg="gray.900"
      borderRadius="md"
      p={4}
      minH={{ base: "200px", lg: "400px" }}
      role="region"
      aria-label="Template preview"
      aria-busy={isActuallyLoading || isCurrentFormatLoading}
    >
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
              <option key={article.id} value={article.id} style={{ backgroundColor: "#2D3748" }}>
                {article.title || article.id}
              </option>
            ))}
          </Select>
        </FormControl>
      )}
      {previewMessages.length > 0 && (
        <Box
          mb={4}
          p={3}
          borderRadius="md"
          border="1px solid"
          borderColor="whiteAlpha.200"
          bg="gray.800"
        >
          {isBrandingDisabled && (
            <HStack spacing={2} mb={2} id="branding-disabled-reason">
              <InfoIcon boxSize={3} color="whiteAlpha.700" aria-hidden="true" />
              <Text fontSize="sm" color="whiteAlpha.700">
                {brandingDisabledReason}
              </Text>
            </HStack>
          )}
          {!isBrandingDisabled && !webhooksAllowed && (
            <HStack spacing={2} mb={2}>
              <LockIcon boxSize={3} color="whiteAlpha.700" />
              <Text fontSize="xs" color="whiteAlpha.700">
                Free plan — preview how your branding looks, then upgrade to save it.
              </Text>
            </HStack>
          )}
          <HStack spacing={3} flexWrap="wrap">
            <FormControl flex={1} minW="150px" isDisabled={isBrandingDisabled}>
              <FormLabel fontSize="xs" color="gray.400" mb={1}>
                Display Name
              </FormLabel>
              <Input
                size="sm"
                bg="gray.700"
                borderColor="gray.600"
                placeholder="e.g. Gaming News"
                value={brandingDisplayName}
                onChange={(e) => setBrandingDisplayName(e.target.value)}
                opacity={isBrandingDisabled ? 0.6 : undefined}
                aria-describedby={isBrandingDisabled ? "branding-disabled-reason" : undefined}
              />
            </FormControl>
            <FormControl flex={1} minW="150px" isDisabled={isBrandingDisabled}>
              <FormLabel fontSize="xs" color="gray.400" mb={1}>
                Avatar URL
              </FormLabel>
              <Input
                size="sm"
                bg="gray.700"
                borderColor="gray.600"
                placeholder="https://example.com/avatar.png"
                value={brandingAvatarUrl}
                onChange={(e) => setBrandingAvatarUrl(e.target.value)}
                opacity={isBrandingDisabled ? 0.6 : undefined}
                aria-describedby={isBrandingDisabled ? "branding-disabled-reason" : undefined}
              />
            </FormControl>
          </HStack>
        </Box>
      )}
      {showComparisonPreview && (
        <VStack spacing={4} align="stretch">
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
                <DiscordMessageDisplay
                  messages={currentFormatMessages}
                  maxHeight={200}
                  username={brandingDisplayName || undefined}
                  avatarUrl={brandingAvatarUrl || undefined}
                  showVerifiedInAppBadge={!hasBrandingValues}
                />
              )}
            {!isCurrentFormatLoading &&
              !isCurrentFormatError &&
              currentFormatMessages.length === 0 && (
                <Box p={8} textAlign="center" bg="gray.800" borderRadius="md" color="gray.500">
                  No current format to display
                </Box>
              )}
          </Box>
          <Box>
            <Text fontSize="sm" fontWeight="semibold" color="gray.400" mb={2}>
              Template Preview
            </Text>
            {!selectedTemplateId && (
              <Box p={8} textAlign="center" bg="gray.800" borderRadius="md" color="gray.500">
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
                <DiscordMessageDisplay
                  messages={previewMessages}
                  maxHeight={200}
                  username={brandingDisplayName || undefined}
                  avatarUrl={brandingAvatarUrl || undefined}
                  showVerifiedInAppBadge={!hasBrandingValues}
                />
              )}
            {selectedTemplateId &&
              !isActuallyLoading &&
              !isPreviewError &&
              previewMessages.length === 0 && (
                <Box p={8} textAlign="center" bg="gray.800" borderRadius="md" color="gray.500">
                  There are currently no articles in the feed to preview. You can save now -
                  previews will be available once articles arrive.
                </Box>
              )}
          </Box>
          <Text fontSize="sm" color="gray.400" mt={2}>
            These are approximate previews. Send to Discord to see the actual representation.
          </Text>
        </VStack>
      )}
      {!showComparisonPreview && (
        <Box>
          <Text fontSize="sm" color="gray.400" mb={3}>
            Preview
          </Text>
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
                username={brandingDisplayName || undefined}
                avatarUrl={brandingAvatarUrl || undefined}
                showVerifiedInAppBadge={!hasBrandingValues}
              />
            )}
          {selectedTemplateId &&
            !isActuallyLoading &&
            !isPreviewError &&
            previewMessages.length === 0 &&
            articles.length === 0 && (
              <Text color="gray.500" textAlign="center" py={8}>
                There are currently no articles in the feed to preview. You can save now - previews
                will be available once articles arrive.
              </Text>
            )}
          {!!articles.length && (
            <Text fontSize="sm" color="gray.400" mt={2}>
              This is an approximate preview. Send to Discord to see the actual representation.
            </Text>
          )}
        </Box>
      )}
      {onTestSend && hasArticles && (
        <Box mt={4}>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              onTestSend?.({
                name: brandingDisplayName,
                iconUrl: brandingAvatarUrl || undefined,
              })
            }
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
  );

  const renderModalBodyContent = () => {
    if (modalView === "upgrade") {
      const hasPreview = isActuallyLoading || previewMessages.length > 0;

      if (!hasPreview) {
        return renderUpgradePrompt();
      }

      return (
        <TemplateGalleryLayout
          templateList={renderUpgradePrompt()}
          preview={renderPreviewColumn()}
        />
      );
    }

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
          preview={renderPreviewColumn()}
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
      closeOnEsc={modalView === "editor"}
      finalFocusRef={finalFocusRef}
      trapFocus={!isPaddleCheckoutOpen}
    >
      <ModalOverlay />
      <ModalContent
        maxH={{ base: "100dvh", lg: "90vh" }}
        height={{ base: "100dvh", md: "auto" }}
        data-testid={testId}
        aria-labelledby="template-gallery-modal-header"
        onKeyDown={(e) => {
          if (e.key === "Escape" && modalView === "upgrade") {
            e.stopPropagation();
            setModalView("editor");
          }
        }}
      >
        <ModalHeader id="template-gallery-modal-header">
          {modalTitle || "Choose a Message Format Template"}
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody>{renderModalBodyContent()}</ModalBody>
        {/* Hide footer when error panel or upgrade prompt is showing */}
        {!showErrorPanel && modalView === "editor" && (
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
                  {!webhooksAllowed && hasBrandingValues ? (
                    <>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          if (isSaveLoading) return;
                          setBrandingDisplayName("");
                          setBrandingAvatarUrl("");
                          if (onSave) onSave();
                        }}
                        isDisabled={isSaveLoading}
                      >
                        Save without branding
                      </Button>
                      <Button colorScheme="blue" onClick={() => setModalView("upgrade")}>
                        Upgrade to save with branding
                      </Button>
                    </>
                  ) : (
                    <Button
                      ref={saveButtonRef}
                      colorScheme="blue"
                      aria-disabled={isSaveLoading}
                      onClick={(e) => {
                        e.preventDefault();
                        if (isSaveLoading) {
                          return;
                        }
                        handleSave();
                      }}
                    >
                      {isSaveLoading ? "Saving..." : "Save"}
                    </Button>
                  )}
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
                {!webhooksAllowed && hasBrandingValues ? (
                  <>
                    <Button
                      variant="outline"
                      mr={3}
                      onClick={() => {
                        setBrandingDisplayName("");
                        setBrandingAvatarUrl("");
                        if (onPrimaryAction && selectedTemplateId)
                          onPrimaryAction(selectedTemplateId);
                      }}
                    >
                      Save without branding
                    </Button>
                    <Button colorScheme="blue" onClick={() => setModalView("upgrade")}>
                      Upgrade to save with branding
                    </Button>
                  </>
                ) : (
                  onPrimaryAction && (
                    <Button
                      ref={saveButtonRef}
                      colorScheme="blue"
                      isLoading={isPrimaryActionLoading}
                      onClick={handlePrimaryAction}
                    >
                      {primaryActionLabel}
                    </Button>
                  )
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
