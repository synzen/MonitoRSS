import { useState, useEffect, useCallback } from "react";
import { TestSendFeedback } from "../../templates/types";
import { DEFAULT_TEMPLATE, getTemplateById } from "../../templates/constants/templates";
import { useSendTestArticleDirect } from "./useSendTestArticleDirect";
import convertMessageBuilderStateToConnectionUpdate from "../../../pages/MessageBuilder/utils/convertMessageBuilderStateToConnectionUpdate";
import { SendTestArticleDeliveryStatus } from "@/types";

/**
 * Maps a SendTestArticleDeliveryStatus to a user-friendly error message.
 * Reuses the same messaging pattern from SendTestArticleContext.tsx
 */
export const getErrorMessageByStatus = (status: SendTestArticleDeliveryStatus): string => {
  switch (status) {
    case SendTestArticleDeliveryStatus.BadPayload:
      return "Discord couldn't process this message. The template may have placeholders that couldn't be filled with the article's data.";
    case SendTestArticleDeliveryStatus.MissingChannel:
      return "The Discord channel could not be found. It may have been deleted.";
    case SendTestArticleDeliveryStatus.MissingApplicationPermission:
      return "The bot doesn't have permission to send messages to this channel.";
    case SendTestArticleDeliveryStatus.TooManyRequests:
      return "Discord is rate limiting requests. Please wait a moment and try again.";
    case SendTestArticleDeliveryStatus.ThirdPartyInternalError:
      return "Discord encountered an internal error. Please try again later.";
    case SendTestArticleDeliveryStatus.NoArticles:
      return "No articles available to send.";
    default:
      return "Failed to send test article. Please try again.";
  }
};

export interface UseTestSendFlowOptions {
  feedId: string | undefined;
  channelId: string | undefined;
  threadId?: string | undefined;
  webhookName?: string | undefined;
  webhookIconUrl?: string | undefined;
  selectedTemplateId: string | undefined;
  selectedArticleId: string | undefined;
  detectedImageField: string | null;
  isOpen: boolean;
  createConnection: () => Promise<string | undefined>;
  updateConnectionTemplate: (connectionId: string) => Promise<void>;
  onSaveSuccess: (connectionName: string | undefined) => void;
  onClose: () => void;
  getConnectionName: () => string | undefined;
}

export interface UseTestSendFlowResult {
  createdConnectionId: string | undefined;
  testSendFeedback: TestSendFeedback | null;
  isSaving: boolean;
  isTestSending: boolean;
  handleTestSend: () => Promise<void>;
  handleSave: () => Promise<void>;
  handleSkip: (submitForm: () => Promise<void>) => Promise<void>;
  setCreatedConnectionId: (id: string | undefined) => void;
  clearTestSendFeedback: () => void;
}

export const useTestSendFlow = ({
  feedId,
  channelId,
  threadId,
  webhookName,
  webhookIconUrl,
  selectedTemplateId,
  selectedArticleId,
  detectedImageField,
  isOpen,
  createConnection,
  updateConnectionTemplate,
  onSaveSuccess,
  onClose,
  getConnectionName,
}: UseTestSendFlowOptions): UseTestSendFlowResult => {
  const [createdConnectionId, setCreatedConnectionId] = useState<string | undefined>();
  const [testSendFeedback, setTestSendFeedback] = useState<TestSendFeedback | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isTestSending, setIsTestSending] = useState(false);

  const sendTestArticleDirectMutation = useSendTestArticleDirect();

  // Clear test send feedback when template or article selection changes
  useEffect(() => {
    setTestSendFeedback(null);
  }, [selectedTemplateId, selectedArticleId]);

  // Reset test send state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setCreatedConnectionId(undefined);
      setTestSendFeedback(null);
      setIsSaving(false);
      setIsTestSending(false);
    }
  }, [isOpen]);

  // Handle test send - now uses direct send without creating a connection
  const handleTestSend = useCallback(async () => {
    setIsTestSending(true);

    try {
      if (!feedId || !selectedArticleId || !channelId) {
        return;
      }

      // Get template data to send
      const templateData = getTemplateUpdateData(selectedTemplateId, detectedImageField || "image");

      const response = await sendTestArticleDirectMutation.mutateAsync({
        feedId,
        data: {
          article: { id: selectedArticleId },
          channelId,
          threadId,
          content: templateData.content,
          embeds: templateData.embeds,
          componentsV2: templateData.componentsV2,
          placeholderLimits: templateData.placeholderLimits,
          webhook: webhookName
            ? {
                name: webhookName,
                iconUrl: webhookIconUrl,
              }
            : undefined,
        },
      });

      // Check the actual delivery status, not just HTTP success
      if (response.result.status === SendTestArticleDeliveryStatus.Success) {
        setTestSendFeedback({
          status: "success",
          message: "Article sent to Discord successfully!",
        });
      } else {
        // Map status to user-friendly message
        const errorMessage = getErrorMessageByStatus(response.result.status);
        setTestSendFeedback({
          status: "error",
          message: errorMessage,
          deliveryStatus: response.result.status,
          apiPayload: response.result.apiPayload,
          apiResponse: response.result.apiResponse,
        });
      }
    } catch (err) {
      setTestSendFeedback({
        status: "error",
        message: "Failed to send test article. Please try again.",
      });
    } finally {
      setIsTestSending(false);
    }
  }, [
    feedId,
    selectedArticleId,
    channelId,
    threadId,
    webhookName,
    webhookIconUrl,
    selectedTemplateId,
    sendTestArticleDirectMutation,
  ]);

  // Create connection if not already created (for save)
  const ensureConnectionCreated = useCallback(async (): Promise<string | undefined> => {
    if (createdConnectionId) {
      return createdConnectionId;
    }

    const newConnectionId = await createConnection();

    if (newConnectionId) {
      setCreatedConnectionId(newConnectionId);
    }

    return newConnectionId;
  }, [createdConnectionId, createConnection]);

  // Handle save - creates connection and applies template
  const handleSave = useCallback(async () => {
    setIsSaving(true);

    try {
      // If connection already created (from previous save attempt), just update template and close
      if (createdConnectionId && feedId) {
        await updateConnectionTemplate(createdConnectionId);

        const connectionName = getConnectionName();
        onSaveSuccess(connectionName);
        onClose();

        return;
      }

      // Create the connection
      const connectionId = await ensureConnectionCreated();

      if (connectionId && feedId) {
        const connectionName = getConnectionName();
        onSaveSuccess(connectionName);
        onClose();
      }
    } catch (err) {
      // Error handled by mutation error state
    } finally {
      setIsSaving(false);
    }
  }, [
    createdConnectionId,
    feedId,
    updateConnectionTemplate,
    getConnectionName,
    onSaveSuccess,
    onClose,
    ensureConnectionCreated,
  ]);

  // Handle skip (apply default template and save via form submission)
  const handleSkip = useCallback(async (submitForm: () => Promise<void>) => {
    setIsSaving(true);

    try {
      await submitForm();
    } finally {
      setIsSaving(false);
    }
  }, []);

  // Clear test send feedback (used when dismissing error panel)
  const clearTestSendFeedback = useCallback(() => {
    setTestSendFeedback(null);
  }, []);

  return {
    createdConnectionId,
    testSendFeedback,
    isSaving,
    isTestSending,
    handleTestSend,
    handleSave,
    handleSkip,
    setCreatedConnectionId,
    clearTestSendFeedback,
  };
};

/**
 * Helper function to build template update details
 */
export const getTemplateUpdateData = (
  selectedTemplateId: string | undefined,
  imageField: string = "image"
) => {
  const templateToApply = selectedTemplateId
    ? getTemplateById(selectedTemplateId) || DEFAULT_TEMPLATE
    : DEFAULT_TEMPLATE;

  const messageComponent = templateToApply.createMessageComponent(imageField);

  return convertMessageBuilderStateToConnectionUpdate(messageComponent);
};
