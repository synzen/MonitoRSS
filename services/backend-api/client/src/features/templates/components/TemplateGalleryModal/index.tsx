import React, { useState, useEffect, useRef, useContext } from "react";
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  VStack,
  Box,
  Text,
  Alert,
  AlertIcon,
  VisuallyHidden,
  useRadioGroup,
} from "@chakra-ui/react";
import { useTemplatePreview } from "./useTemplatePreview";
import { useCurrentFormatPreview } from "./useCurrentFormatPreview";
import { TemplateCard } from "../TemplateCard";
import { InlineErrorAlert } from "../../../../components/InlineErrorAlert";
import { TemplateGalleryLoadingSkeleton } from "./TemplateGalleryLoadingSkeleton";
import { DetectedFields, Template, TestSendFeedback } from "../../types";
import { isTemplateCompatible, getDisabledReason } from "./templateCompatibility";
import { TestSendErrorPanel } from "../TestSendErrorPanel";
import { UserFeed } from "../../../feed";
import { FeedDiscordChannelConnection } from "../../../../types";
import { TemplateGalleryLayout } from "./TemplateGalleryLayout";
import { MessageComponentRoot } from "../../../../pages/MessageBuilder/types";
import { PRICE_IDS, ProductKey } from "../../../../constants";
import { usePaddleContext } from "../../../../contexts/PaddleContext";
import { PricingDialogContext } from "../../../../contexts";
import { UpgradePrompt } from "./UpgradePrompt";
import { PreviewColumn } from "./PreviewColumn";
import { ModalFooterActions } from "./ModalFooterActions";
import { BrandingProvider, useBrandingContext } from "./BrandingContext";
import { Branding, Article } from "./types";

export type { Article } from "./types";
export type { Branding } from "./types";

const TEMPLATE_GALLERY_HELPER_TEXT =
  "Pick a starting point for your message layout. You can customize everything after applying.";

interface TemplateGalleryBaseProps {
  isOpen: boolean;
  onClose: () => void;
  templates: Template[];
  selectedTemplateId?: string;
  onTemplateSelect: (templateId: string) => void;
  feedFields: string[];
  detectedFields: DetectedFields;
  articles: Article[];
  selectedArticleId?: string;
  onArticleChange: (articleId: string) => void;
  isLoadingArticles?: boolean;
  feedId: string;
  userFeed?: UserFeed;
  finalFocusRef?: React.RefObject<HTMLElement>;
  brandingDisabledReason?: string;
  tertiaryActionLabel?: string;
  onTertiaryAction?: () => void;
}

interface TemplateGalleryEditorProps extends TemplateGalleryBaseProps {
  mode: "editor";
  onCancel?: () => void;
  testId?: string;
  onTestSend: (branding?: Branding) => void;
  isTestSendLoading?: boolean;
  testSendFeedback?: TestSendFeedback | null;
  onClearTestSendFeedback?: () => void;
  onSave: (branding?: Branding) => void;
  isSaveLoading?: boolean;
  saveError?: { message: string } | null;
}

interface TemplateGalleryPickerProps extends TemplateGalleryBaseProps {
  mode: "picker";
  connectionId: string;
  connection: FeedDiscordChannelConnection;
  modalTitle: string;
  showComparisonPreview: boolean;
  currentMessageComponent?: MessageComponentRoot;
  primaryActionLabel: string;
  onPrimaryAction: (selectedTemplateId: string, branding?: Branding) => void;
  isPrimaryActionLoading?: boolean;
  secondaryActionLabel: string;
  onSecondaryAction: () => void;
}

export type TemplateGalleryModalProps = TemplateGalleryEditorProps | TemplateGalleryPickerProps;

export { isTemplateCompatible, getMissingFields, getDisabledReason } from "./templateCompatibility";

const TemplateGalleryModalInner = (props: TemplateGalleryModalProps) => {
  const {
    isOpen,
    onClose,
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
    userFeed,
    tertiaryActionLabel,
    onTertiaryAction,
    finalFocusRef,
  } = props;

  const { webhooksAllowed, hasBrandingValues, getBranding, clearBranding } = useBrandingContext();

  const { openCheckout, isLoaded: isPaddleLoaded, getPricePreview } = usePaddleContext();
  const { onOpen: onOpenPricingDialog } = useContext(PricingDialogContext);

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
    if (!isOpen) {
      setModalView("editor");
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

  const [showTemplateError, setShowTemplateError] = useState(false);

  useEffect(() => {
    if (selectedTemplateId) {
      setShowTemplateError(false);
    }
  }, [selectedTemplateId]);

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

  const connectionId = props.mode === "picker" ? props.connectionId : undefined;
  const connection = props.mode === "picker" ? props.connection : undefined;
  const showComparisonPreview = props.mode === "picker" ? props.showComparisonPreview : false;
  const currentMessageComponent =
    props.mode === "picker" ? props.currentMessageComponent : undefined;
  const modalTitle = props.mode === "picker" ? props.modalTitle : undefined;

  const testId = props.mode === "editor" ? props.testId : undefined;
  const onTestSend = props.mode === "editor" ? props.onTestSend : undefined;
  const isTestSendLoading = props.mode === "editor" ? props.isTestSendLoading : undefined;
  const testSendFeedback = props.mode === "editor" ? props.testSendFeedback : undefined;
  const onClearTestSendFeedback =
    props.mode === "editor" ? props.onClearTestSendFeedback : undefined;
  const onSave = props.mode === "editor" ? props.onSave : undefined;
  const isSaveLoading = props.mode === "editor" ? props.isSaveLoading : undefined;
  const saveError = props.mode === "editor" ? props.saveError : undefined;

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

  const isActuallyLoading = fetchStatus === "fetching";

  const wasLoadingRef = useRef(false);
  const [previewAnnouncement, setPreviewAnnouncement] = useState("");
  const saveErrorRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (saveError && saveErrorRef.current) {
      saveErrorRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [saveError]);

  const showErrorPanel = testSendFeedback?.status === "error" && testSendFeedback.deliveryStatus;

  const validateAndDispatch = (callback: (branding?: Branding) => void) => {
    if (!selectedTemplateId) {
      setShowTemplateError(true);
      return;
    }

    if (!webhooksAllowed && hasBrandingValues) {
      setModalView("upgrade");
      return;
    }

    callback(getBranding());
  };

  const handlePrimaryAction = () => {
    if (props.mode !== "picker") return;

    validateAndDispatch((branding) => {
      props.onPrimaryAction(selectedTemplateId!, branding);
    });
  };

  const handleSave = () => {
    if (props.mode !== "editor") return;

    validateAndDispatch((branding) => {
      props.onSave(branding);
    });
  };

  const upgradePromptElement = (
    <UpgradePrompt
      upgradeHeadingRef={upgradeHeadingRef}
      billingInterval={billingInterval}
      onBillingIntervalChange={setBillingInterval}
      isPriceLoading={isPriceLoading}
      tier1Prices={tier1Prices}
      isPaddleLoaded={isPaddleLoaded}
      onCheckout={(priceId) => {
        setIsPaddleCheckoutOpen(true);
        openCheckout({
          prices: [{ priceId, quantity: 1 }],
          displayMode: "overlay",
        });
      }}
      onBackToEditor={() => setModalView("editor")}
    />
  );

  const previewColumnElement = (
    <PreviewColumn
      articles={articles}
      selectedArticleId={selectedArticleId}
      onArticleChange={onArticleChange}
      selectedTemplateId={selectedTemplateId}
      previewMessages={previewMessages}
      isActuallyLoading={isActuallyLoading}
      isPreviewError={isPreviewError}
      showComparisonPreview={showComparisonPreview}
      currentFormatMessages={currentFormatMessages}
      isCurrentFormatLoading={isCurrentFormatLoading}
      isCurrentFormatError={isCurrentFormatError}
      onTestSend={onTestSend}
      isTestSendLoading={isTestSendLoading}
      canTestSend={canTestSend}
      hasArticles={hasArticles}
      testSendFeedback={testSendFeedback}
    />
  );

  const renderModalBodyContent = () => {
    if (modalView === "upgrade") {
      const hasPreview = isActuallyLoading || previewMessages.length > 0;

      if (!hasPreview) {
        return upgradePromptElement;
      }

      return (
        <TemplateGalleryLayout templateList={upgradePromptElement} preview={previewColumnElement} />
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
          preview={previewColumnElement}
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

  const renderFooter = () => {
    if (showErrorPanel || modalView !== "editor") return null;

    if (props.mode === "editor") {
      return (
        <ModalFooterActions
          mode="editor"
          showTemplateError={showTemplateError}
          tertiaryActionLabel={tertiaryActionLabel}
          onTertiaryAction={onTertiaryAction}
          onCancel={props.onCancel || onClose}
          onSaveWithoutBranding={() => {
            if (props.isSaveLoading) return;
            clearBranding();
            props.onSave();
          }}
          onUpgrade={() => setModalView("upgrade")}
          isSaveLoading={props.isSaveLoading}
          onSave={handleSave}
          saveButtonRef={saveButtonRef}
        />
      );
    }

    return (
      <ModalFooterActions
        mode="picker"
        showTemplateError={showTemplateError}
        tertiaryActionLabel={tertiaryActionLabel}
        onTertiaryAction={onTertiaryAction}
        onUpgrade={() => setModalView("upgrade")}
        secondaryActionLabel={props.secondaryActionLabel}
        onSecondaryAction={props.onSecondaryAction}
        onPrimaryActionWithoutBranding={() => {
          clearBranding();
          if (selectedTemplateId) props.onPrimaryAction(selectedTemplateId);
        }}
        onPrimaryAction={handlePrimaryAction}
        isPrimaryActionLoading={props.isPrimaryActionLoading}
        primaryActionLabel={props.primaryActionLabel}
        saveButtonRef={saveButtonRef}
      />
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
        {renderFooter()}
      </ModalContent>
    </Modal>
  );
};

const TemplateGalleryModalComponent = (props: TemplateGalleryModalProps) => (
  <BrandingProvider disabledReason={props.brandingDisabledReason} isOpen={props.isOpen}>
    <TemplateGalleryModalInner {...props} />
  </BrandingProvider>
);

export const TemplateGalleryModal = React.memo(TemplateGalleryModalComponent);
TemplateGalleryModal.displayName = "TemplateGalleryModal";
