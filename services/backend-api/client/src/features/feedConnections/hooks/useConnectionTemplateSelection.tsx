import { useState, useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import RouteParams from "../../../types/RouteParams";
import { useUserFeedArticles, useUserFeed } from "../../feed/hooks";
import { TEMPLATES, getTemplateById } from "../../templates/constants/templates";
import convertMessageBuilderStateToConnectionUpdate from "../../../pages/MessageBuilder/utils/convertMessageBuilderStateToConnectionUpdate";
import { detectFields } from "../../templates/utils";
import { DetectedFields } from "../../templates/types";
import { useTemplateFeedFields } from "../../templates/hooks";

enum ConnectionCreationStep {
  ServerChannel = "server-channel",
  TemplateSelection = "template-selection",
}

interface UseConnectionTemplateSelectionOptions {
  isOpen: boolean;
  isEditing: boolean;
}

export const useConnectionTemplateSelection = ({
  isOpen,
  isEditing,
}: UseConnectionTemplateSelectionOptions) => {
  const [currentStep, setCurrentStep] = useState<ConnectionCreationStep>(
    ConnectionCreationStep.ServerChannel
  );
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | undefined>(undefined);
  const [selectedArticleId, setSelectedArticleId] = useState<string | undefined>();

  const { feedId } = useParams<RouteParams>();

  // Fetch user feed data for template preview
  const { feed: userFeed } = useUserFeed({ feedId });

  // Fetch articles for template compatibility and preview
  const { data: articlesData, fetchStatus } = useUserFeedArticles({
    feedId,
    data: {
      skip: 0,
      limit: 10,
      selectProperties: ["*"],
      formatOptions: {
        dateFormat: userFeed?.formatOptions?.dateFormat,
        dateTimezone: userFeed?.formatOptions?.dateTimezone,
        disableImageLinkPreviews: false,
        formatTables: false,
        ignoreNewLines: false,
        stripImages: false,
      },
    },
    disabled: !userFeed || currentStep !== ConnectionCreationStep.TemplateSelection,
  });

  // Extract feed fields from articles - only include fields with actual content
  const articles = articlesData?.result?.articles || [];
  const feedFields = useTemplateFeedFields(articles as Array<Record<string, unknown>>);

  // Auto-detect fields by scanning article values
  const detectedFields = useMemo<DetectedFields>(() => {
    return detectFields(articles);
  }, [articles]);

  // Set first article as selected when articles load
  useEffect(() => {
    if (articles.length > 0 && !selectedArticleId) {
      setSelectedArticleId(articles[0].id);
    }
  }, [articles, selectedArticleId]);

  // Reset state when modal closes (so it's ready for next open without flash)
  useEffect(() => {
    if (!isOpen) {
      setCurrentStep(ConnectionCreationStep.ServerChannel);
      setSelectedTemplateId(undefined);
      setSelectedArticleId(undefined);
    }
  }, [isOpen]);

  const handleNextStep = () => {
    if (currentStep === ConnectionCreationStep.ServerChannel && !isEditing) {
      setCurrentStep(ConnectionCreationStep.TemplateSelection);
    }
  };

  const handleBackStep = () => {
    if (currentStep === ConnectionCreationStep.TemplateSelection) {
      setCurrentStep(ConnectionCreationStep.ServerChannel);
    }
  };

  const getTemplateUpdateDetails = () => {
    if (!selectedTemplateId) {
      return undefined;
    }

    // Get template and create message component with detected fields
    const template = getTemplateById(selectedTemplateId);

    if (!template) {
      return undefined;
    }

    const messageComponent = template.createMessageComponent(detectedFields);

    return convertMessageBuilderStateToConnectionUpdate(messageComponent);
  };

  const isTemplateStep = currentStep === ConnectionCreationStep.TemplateSelection && !isEditing;
  const isLoadingArticles = fetchStatus === "fetching";

  return {
    currentStep,
    isTemplateStep,
    selectedTemplateId,
    setSelectedTemplateId,
    selectedArticleId,
    setSelectedArticleId,
    feedId,
    userFeed,
    articles,
    feedFields,
    detectedFields,
    isLoadingArticles,
    handleNextStep,
    handleBackStep,
    getTemplateUpdateDetails,
    templates: TEMPLATES,
  };
};

export { ConnectionCreationStep };
