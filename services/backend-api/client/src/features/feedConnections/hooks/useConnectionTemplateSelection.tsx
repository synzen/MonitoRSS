import { useState, useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import RouteParams from "../../../types/RouteParams";
import { useUserFeedArticles, useUserFeed } from "../../feed/hooks";
import { TEMPLATES, DEFAULT_TEMPLATE, getTemplateById } from "../../templates/constants/templates";
import convertMessageBuilderStateToConnectionUpdate from "../../../pages/MessageBuilder/utils/convertMessageBuilderStateToConnectionUpdate";
import { detectImageField } from "../../templates/utils";

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
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(DEFAULT_TEMPLATE.id);
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
      selectProperties: ["id", "title"],
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
  const feedFields =
    articles.length > 0
      ? Object.keys(articles[0]).filter((key) => {
          if (key === "id" || key === "idHash") {
            return false;
          }

          const value = (articles[0] as Record<string, unknown>)[key];

          // Field must have a truthy value (not undefined, null, or empty string)
          return value !== undefined && value !== null && value !== "";
        })
      : [];

  // Auto-detect image field by scanning article values for image URLs
  const detectedImageField = useMemo(() => {
    if (articles.length === 0) return null;

    return detectImageField(articles[0] as Record<string, unknown>);
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
      setSelectedTemplateId(DEFAULT_TEMPLATE.id);
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
    const imageField = detectedImageField || "image";
    const templateId = selectedTemplateId || DEFAULT_TEMPLATE.id;

    // Get template and create message component with the detected image field
    const template = getTemplateById(templateId) || DEFAULT_TEMPLATE;
    const messageComponent = template.createMessageComponent(imageField);

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
    detectedImageField,
    isLoadingArticles,
    handleNextStep,
    handleBackStep,
    getTemplateUpdateDetails,
    templates: TEMPLATES,
  };
};

export { ConnectionCreationStep };
