import { ComponentType } from "../../../pages/MessageBuilder/types";
import { DiscordButtonStyle } from "../../../pages/MessageBuilder/constants/DiscordButtonStyle";
import { Template } from "../types";

export const DEFAULT_TEMPLATE_ID = "default";

export const DEFAULT_TEMPLATE: Template = {
  id: "default",
  name: "Simple Text",
  description: "Clean text format that works with any feed",
  requiredFields: [],
  messageComponent: {
    type: ComponentType.LegacyRoot,
    id: "default-root",
    name: "Simple Text Template",
    children: [
      {
        type: ComponentType.LegacyText,
        id: "default-text",
        name: "Message Content",
        content: "**{{title}}**\n{{link}}",
      },
    ],
  },
};

export const RICH_EMBED_TEMPLATE: Template = {
  id: "rich-embed",
  name: "Rich Embed",
  description: "Full embed with image, description, and branding",
  requiredFields: ["description"],
  messageComponent: {
    type: ComponentType.LegacyRoot,
    id: "rich-embed-root",
    name: "Rich Embed Template",
    children: [
      {
        type: ComponentType.LegacyEmbedContainer,
        id: "rich-embed-container",
        name: "Embeds",
        children: [
          {
            type: ComponentType.LegacyEmbed,
            id: "rich-embed-embed",
            name: "Main Embed",
            color: 5814783,
            children: [
              {
                type: ComponentType.LegacyEmbedTitle,
                id: "rich-embed-title",
                name: "Title",
                title: "{{title}}",
                titleUrl: "{{link}}",
              },
              {
                type: ComponentType.LegacyEmbedDescription,
                id: "rich-embed-desc",
                name: "Description",
                description: "{{description}}",
              },
              {
                type: ComponentType.LegacyEmbedThumbnail,
                id: "rich-embed-thumb",
                name: "Thumbnail",
                thumbnailUrl: "{{image}}",
              },
              {
                type: ComponentType.LegacyEmbedFooter,
                id: "rich-embed-footer",
                name: "Footer",
                footerText: "📰 {{feed::title}}",
              },
              {
                type: ComponentType.LegacyEmbedTimestamp,
                id: "rich-embed-timestamp",
                name: "Timestamp",
                timestamp: "article",
              },
            ],
          },
        ],
      },
    ],
  },
};

export const COMPACT_CARD_TEMPLATE: Template = {
  id: "compact-card",
  name: "Compact Card",
  description: "Modern card layout with thumbnail and read button",
  requiredFields: ["title"],
  messageComponent: {
    type: ComponentType.V2Root,
    id: "compact-card-root",
    name: "Compact Card Template",
    placeholderLimits: [{ placeholder: "description", characterCount: 100, appendString: "..." }],
    children: [
      {
        type: ComponentType.V2Container,
        id: "compact-card-container",
        name: "Card Container",
        accentColor: 5814783,
        children: [
          {
            type: ComponentType.V2Section,
            id: "compact-card-section",
            name: "Content Section",
            children: [
              {
                type: ComponentType.V2TextDisplay,
                id: "compact-card-text",
                name: "Title & Description",
                content: "**{{title}}**\n{{description}}",
              },
            ],
            accessory: {
              type: ComponentType.V2Thumbnail,
              id: "compact-card-thumb",
              name: "Thumbnail",
              mediaUrl: "{{image}}",
              description: "Article thumbnail",
            },
          },
          {
            type: ComponentType.V2ActionRow,
            id: "compact-card-actions",
            name: "Actions",
            children: [
              {
                type: ComponentType.V2Button,
                id: "compact-card-btn",
                name: "Read More Button",
                label: "Read More",
                style: DiscordButtonStyle.Link,
                disabled: false,
                href: "{{link}}",
              },
            ],
          },
        ],
      },
    ],
  },
};

export const MEDIA_GALLERY_TEMPLATE: Template = {
  id: "media-gallery",
  name: "Media Gallery",
  description: "Showcase images in a modern gallery layout",
  requiredFields: ["image"],
  messageComponent: {
    type: ComponentType.V2Root,
    id: "media-gallery-root",
    name: "Media Gallery Template",
    placeholderLimits: [{ placeholder: "description", characterCount: 150, appendString: "..." }],
    children: [
      {
        type: ComponentType.V2Container,
        id: "media-gallery-container",
        name: "Gallery Container",
        accentColor: 2895667,
        children: [
          {
            type: ComponentType.V2TextDisplay,
            id: "media-gallery-title",
            name: "Title",
            content: "**{{title}}**",
          },
          {
            type: ComponentType.V2TextDisplay,
            id: "media-gallery-desc",
            name: "Description",
            content: "{{description}}",
          },
          {
            type: ComponentType.V2Divider,
            id: "media-gallery-divider",
            name: "Divider",
            visual: true,
            spacing: 1,
            children: [],
          },
          {
            type: ComponentType.V2MediaGallery,
            id: "media-gallery-gallery",
            name: "Image Gallery",
            children: [
              {
                type: ComponentType.V2MediaGalleryItem,
                id: "media-gallery-item-1",
                name: "Image 1",
                mediaUrl: "{{image}}",
                description: "{{title}}",
                children: [],
              },
            ],
          },
          {
            type: ComponentType.V2ActionRow,
            id: "media-gallery-actions",
            name: "Actions",
            children: [
              {
                type: ComponentType.V2Button,
                id: "media-gallery-btn",
                name: "View Button",
                label: "View Article",
                style: DiscordButtonStyle.Link,
                disabled: false,
                href: "{{link}}",
              },
            ],
          },
        ],
      },
    ],
  },
};

export const TEMPLATES: Template[] = [
  DEFAULT_TEMPLATE,
  RICH_EMBED_TEMPLATE,
  COMPACT_CARD_TEMPLATE,
  MEDIA_GALLERY_TEMPLATE,
];

export function getTemplateById(id: string): Template | undefined {
  return TEMPLATES.find((template) => template.id === id);
}

export function getDefaultTemplate(): Template {
  return DEFAULT_TEMPLATE;
}

export function isDefaultTemplate(template: Template): boolean {
  return template.id === DEFAULT_TEMPLATE_ID;
}
