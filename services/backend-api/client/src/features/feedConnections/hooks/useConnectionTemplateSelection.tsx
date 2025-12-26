import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import RouteParams from "../../../types/RouteParams";
import { useUserFeedArticles, useUserFeed } from "../../feed/hooks";
import { Template } from "../../templates/types";
import { ComponentType } from "../../../pages/MessageBuilder/types";
import { UpdateDiscordChannelConnectionInput } from "../api";
import { TEMPLATES, DEFAULT_TEMPLATE, getTemplateById } from "../../templates/constants/templates";

enum ConnectionCreationStep {
  ServerChannel = "server-channel",
  TemplateSelection = "template-selection",
}

// Helper function to convert template messageComponent to update API format
const convertTemplateToUpdateDetails = (
  template: Template
): Partial<UpdateDiscordChannelConnectionInput["details"]> => {
  const { messageComponent } = template;

  if (messageComponent.type === ComponentType.LegacyRoot) {
    // Handle V1/Legacy format
    let content: string | null = null;
    const embeds: UpdateDiscordChannelConnectionInput["details"]["embeds"] = [];

    messageComponent.children?.forEach((child) => {
      if (child.type === ComponentType.LegacyText) {
        content = (child as unknown as { content?: string }).content || null;
      } else if (child.type === ComponentType.LegacyEmbedContainer) {
        const embedContainer = child as unknown as { children?: Array<Record<string, unknown>> };
        embedContainer.children?.forEach((embedComponent) => {
          const embed: NonNullable<
            UpdateDiscordChannelConnectionInput["details"]["embeds"]
          >[number] = {};

          if ((embedComponent as { color?: number }).color) {
            embed.color = String((embedComponent as { color: number }).color);
          }

          const embedChildren =
            (embedComponent as { children?: Array<Record<string, unknown>> }).children || [];
          embedChildren.forEach((subComponent) => {
            const subType = (subComponent as { type: string }).type;

            if (subType === ComponentType.LegacyEmbedAuthor) {
              embed.author = {
                name: (subComponent as { authorName?: string }).authorName || null,
                url: (subComponent as { authorUrl?: string }).authorUrl || null,
                iconUrl: (subComponent as { authorIconUrl?: string }).authorIconUrl || null,
              };
            } else if (subType === ComponentType.LegacyEmbedTitle) {
              embed.title = (subComponent as { title?: string }).title || null;
              embed.url = (subComponent as { titleUrl?: string }).titleUrl || null;
            } else if (subType === ComponentType.LegacyEmbedDescription) {
              embed.description = (subComponent as { description?: string }).description || null;
            } else if (subType === ComponentType.LegacyEmbedImage) {
              embed.image = { url: (subComponent as { imageUrl?: string }).imageUrl || null };
            } else if (subType === ComponentType.LegacyEmbedThumbnail) {
              embed.thumbnail = {
                url: (subComponent as { thumbnailUrl?: string }).thumbnailUrl || null,
              };
            } else if (subType === ComponentType.LegacyEmbedFooter) {
              embed.footer = {
                text: (subComponent as { footerText?: string }).footerText || null,
                iconUrl: (subComponent as { footerIconUrl?: string }).footerIconUrl || null,
              };
            }
          });

          embeds.push(embed);
        });
      }
    });

    return {
      content,
      embeds: embeds.length > 0 ? embeds : undefined,
      componentsV2: null,
      placeholderLimits: messageComponent.placeholderLimits,
    };
  }

  if (messageComponent.type === ComponentType.V2Root) {
    // Handle V2 format - convert to componentsV2 API format
    const V2_TYPE = {
      ActionRow: "ACTION_ROW",
      Button: "BUTTON",
      Section: "SECTION",
      TextDisplay: "TEXT_DISPLAY",
      Thumbnail: "THUMBNAIL",
      Separator: "SEPARATOR",
      Container: "CONTAINER",
      MediaGallery: "MEDIA_GALLERY",
    } as const;

    const getButtonStyleNumber = (style: string): number => {
      const styleMap: Record<string, number> = {
        PRIMARY: 1,
        SECONDARY: 2,
        SUCCESS: 3,
        DANGER: 4,
        LINK: 5,
      };

      return styleMap[style] || 5; // Default to LINK
    };

    const convertV2Child = (child: Record<string, unknown>): Record<string, unknown> | null => {
      const childType = child.type as string;

      if (childType === ComponentType.V2TextDisplay) {
        return { type: V2_TYPE.TextDisplay, content: child.content };
      }

      if (childType === ComponentType.V2Button) {
        return {
          type: V2_TYPE.Button,
          style: getButtonStyleNumber(child.style as string),
          label: child.label || undefined,
          url: child.href || undefined,
          disabled: child.disabled || false,
        };
      }

      if (childType === ComponentType.V2Divider) {
        return {
          type: V2_TYPE.Separator,
          divider: (child.visual as boolean) !== false,
          spacing: (child.spacing as number) || 1,
        };
      }

      if (childType === ComponentType.V2ActionRow) {
        const actionRowChildren = (child.children as Array<Record<string, unknown>>) || [];

        return {
          type: V2_TYPE.ActionRow,
          components: actionRowChildren
            .map((btn) => convertV2Child(btn))
            .filter((c): c is Record<string, unknown> => c !== null),
        };
      }

      if (childType === ComponentType.V2Section) {
        const sectionChildren = (child.children as Array<Record<string, unknown>>) || [];
        const result: Record<string, unknown> = {
          type: V2_TYPE.Section,
          components: sectionChildren
            .filter((c) => (c.type as string) === ComponentType.V2TextDisplay)
            .map((c) => ({ type: V2_TYPE.TextDisplay, content: c.content })),
        };

        const accessory = child.accessory as Record<string, unknown> | undefined;

        if (accessory) {
          if ((accessory.type as string) === ComponentType.V2Button) {
            result.accessory = convertV2Child(accessory);
          } else if ((accessory.type as string) === ComponentType.V2Thumbnail) {
            result.accessory = {
              type: V2_TYPE.Thumbnail,
              media: { url: accessory.mediaUrl },
              description: accessory.description || undefined,
              spoiler: accessory.spoiler || false,
            };
          }
        }

        return result;
      }

      if (childType === ComponentType.V2MediaGallery) {
        const galleryChildren = (child.children as Array<Record<string, unknown>>) || [];

        return {
          type: V2_TYPE.MediaGallery,
          items: galleryChildren.map((item) => ({
            media: { url: item.mediaUrl },
            description: item.description || undefined,
            spoiler: item.spoiler || false,
          })),
        };
      }

      if (childType === ComponentType.V2Container) {
        const containerChildren = (child.children as Array<Record<string, unknown>>) || [];

        return {
          type: V2_TYPE.Container,
          accent_color: (child.accentColor as number) ?? undefined,
          spoiler: (child.spoiler as boolean) ?? false,
          components: containerChildren
            .map((c) => convertV2Child(c))
            .filter((c): c is Record<string, unknown> => c !== null),
        };
      }

      return null;
    };

    const componentsV2 = messageComponent.children
      .map((child) => convertV2Child(child as unknown as Record<string, unknown>))
      .filter((c): c is Record<string, unknown> => c !== null) as NonNullable<
      UpdateDiscordChannelConnectionInput["details"]["componentsV2"]
    >;

    return {
      content: null,
      embeds: undefined,
      componentsV2: componentsV2.length > 0 ? componentsV2 : null,
      placeholderLimits: messageComponent.placeholderLimits,
    };
  }

  return {};
};

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
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | undefined>();
  const [selectedArticleId, setSelectedArticleId] = useState<string | undefined>();

  const { feedId } = useParams<RouteParams>();

  // Fetch user feed data for template preview
  const { feed: userFeed } = useUserFeed({ feedId });

  // Fetch articles for template compatibility and preview
  const { data: articlesData } = useUserFeedArticles({
    feedId,
    data: {
      skip: 0,
      limit: 10,
      selectProperties: ["id", "title", "description", "link", "image"],
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

  // Extract feed fields from articles
  const articles = articlesData?.result?.articles || [];
  const feedFields =
    articles.length > 0
      ? Object.keys(articles[0]).filter(
          (key) =>
            key !== "id" &&
            key !== "idHash" &&
            (articles[0] as Record<string, unknown>)[key] !== undefined
        )
      : [];

  // Set first article as selected when articles load
  useEffect(() => {
    if (articles.length > 0 && !selectedArticleId) {
      setSelectedArticleId(articles[0].id);
    }
  }, [articles, selectedArticleId]);

  useEffect(() => {
    if (currentStep === ConnectionCreationStep.TemplateSelection && !selectedTemplateId) {
      const compatibleTemplates = TEMPLATES.filter((template) => {
        if (!template.requiredFields || template.requiredFields.length === 0) {
          return true;
        }

        return template.requiredFields.every((field) => feedFields.includes(field));
      });

      if (compatibleTemplates.length === 1 && compatibleTemplates[0].id === DEFAULT_TEMPLATE.id) {
        setSelectedTemplateId(DEFAULT_TEMPLATE.id);
      }
    }
  }, [currentStep, selectedTemplateId, feedFields]);

  // Reset state when modal closes/opens
  useEffect(() => {
    setCurrentStep(ConnectionCreationStep.ServerChannel);
    setSelectedTemplateId(undefined);
    setSelectedArticleId(undefined);
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
    const templateToApply = selectedTemplateId
      ? getTemplateById(selectedTemplateId) || DEFAULT_TEMPLATE
      : DEFAULT_TEMPLATE;

    return convertTemplateToUpdateDetails(templateToApply);
  };

  const isTemplateStep = currentStep === ConnectionCreationStep.TemplateSelection && !isEditing;

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
    handleNextStep,
    handleBackStep,
    getTemplateUpdateDetails,
    templates: TEMPLATES,
  };
};

export { ConnectionCreationStep, convertTemplateToUpdateDetails };
