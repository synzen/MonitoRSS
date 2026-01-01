import {
  ComponentType,
  MediaGalleryItemComponent,
  MessageComponentRoot,
} from "../../../pages/MessageBuilder/types";
import { DiscordButtonStyle } from "../../../pages/MessageBuilder/constants/DiscordButtonStyle";
import { DetectedFields, Template, TemplateRequiredField } from "../types";
import {
  SimpleTextThumbnail,
  RichEmbedThumbnail,
  CompactCardThumbnail,
  MediaGalleryThumbnail,
} from "../components/TemplateThumbnails";

export const DEFAULT_TEMPLATE_ID = "default";

export const DEFAULT_TEMPLATE: Template = {
  id: "default",
  name: "Simple Text",
  description: "Clean text format that works with any feed",
  ThumbnailComponent: SimpleTextThumbnail,
  requiredFields: [],
  createMessageComponent: (): MessageComponentRoot => ({
    type: ComponentType.LegacyRoot,
    id: "default-root",
    name: "Simple Text Template",
    stripImages: true,
    children: [
      {
        type: ComponentType.LegacyText,
        id: "default-text",
        name: "Message Content",
        content: "**{{title}}**\n{{link}}",
      },
    ],
  }),
};

export const RICH_EMBED_TEMPLATE: Template = {
  id: "rich-embed",
  name: "Rich Embed",
  description: "Full embed with image, description and link button",
  ThumbnailComponent: RichEmbedThumbnail,
  requiredFields: [TemplateRequiredField.Description],
  createMessageComponent: (fields?: DetectedFields): MessageComponentRoot => {
    const imageField = fields?.image[0];
    const descriptionField = fields?.description[0] ?? "description";
    const authorField = fields?.author[0];
    const linkField = fields?.link[0];

    const hasImage = !!imageField;
    const titleComponent = {
      type: ComponentType.V2TextDisplay as const,
      id: "rich-embed-title",
      name: "Title",
      content: linkField
        ? `## [{{title}}]({{${linkField}}})${authorField ? "\n**{{author}}**" : ""}`
        : `## {{title}}${authorField ? "\n**{{author}}**" : ""}`,
    };

    const headerComponent = hasImage
      ? [
          {
            type: ComponentType.V2Section as const,
            id: "rich-embed-section",
            name: "Header Section",
            children: [titleComponent],
            accessory: {
              type: ComponentType.V2Thumbnail as const,
              id: "rich-embed-thumb",
              name: "Thumbnail",
              mediaUrl: `{{${imageField}}}`,
              description: "Article thumbnail",
            },
          },
        ]
      : [titleComponent];

    return {
      type: ComponentType.V2Root,
      id: "rich-embed-root",
      name: "Rich Embed Template",
      placeholderLimits: [
        { placeholder: descriptionField, characterCount: 1750, appendString: "..." },
      ],
      stripImages: true,
      children: [
        {
          type: ComponentType.V2Container,
          id: "rich-embed-container",
          name: "Embed Container",
          children: [
            ...headerComponent,
            {
              type: ComponentType.V2Divider,
              id: "rich-embed-divider",
              name: "Divider",
              visual: true,
              spacing: 1,
              children: [],
            },
            {
              type: ComponentType.V2TextDisplay,
              id: "rich-embed-desc",
              name: "Description",
              content: `{{${descriptionField}}}`,
            },
            ...(linkField
              ? [
                  {
                    type: ComponentType.V2ActionRow as const,
                    id: "rich-embed-actions",
                    name: "Actions",
                    children: [
                      {
                        type: ComponentType.V2Button as const,
                        id: "rich-embed-btn",
                        name: "View Button",
                        label: "View",
                        style: DiscordButtonStyle.Link,
                        disabled: false,
                        href: `{{${linkField}}}`,
                      },
                    ],
                  },
                ]
              : []),
          ],
        },
      ],
    };
  },
};

export const COMPACT_CARD_TEMPLATE: Template = {
  id: "compact-card",
  name: "Compact Card",
  description: "Card layout with a minimal description, thumbnail and view button",
  ThumbnailComponent: CompactCardThumbnail,
  requiredFields: [TemplateRequiredField.Title],
  createMessageComponent: (fields?: DetectedFields): MessageComponentRoot => {
    const imageField = fields?.image[0] ?? "image";
    const descriptionField = fields?.description[0] ?? "description";
    const linkField = fields?.link[0];

    return {
      type: ComponentType.V2Root,
      id: "compact-card-root",
      name: "Compact Card Template",
      placeholderLimits: [
        { placeholder: descriptionField, characterCount: 200, appendString: "..." },
      ],
      stripImages: true,
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
                  content: `**{{title}}**\n{{${descriptionField}}}`,
                },
              ],
              accessory: {
                type: ComponentType.V2Thumbnail,
                id: "compact-card-thumb",
                name: "Thumbnail",
                mediaUrl: `{{${imageField}}}`,
                description: "Article thumbnail",
              },
            },
            ...(linkField
              ? [
                  {
                    type: ComponentType.V2ActionRow as const,
                    id: "compact-card-actions",
                    name: "Actions",
                    children: [
                      {
                        type: ComponentType.V2Button as const,
                        id: "compact-card-btn",
                        name: "View Button",
                        label: "View",
                        style: DiscordButtonStyle.Link,
                        disabled: false,
                        href: `{{${linkField}}}`,
                      },
                    ],
                  },
                ]
              : []),
          ],
        },
      ],
    };
  },
};

export const MEDIA_GALLERY_TEMPLATE: Template = {
  id: "media-gallery",
  name: "Media Gallery",
  description: "Showcase multiple images in a gallery layout",
  ThumbnailComponent: MediaGalleryThumbnail,
  requiredFields: [TemplateRequiredField.Image],
  createMessageComponent: (fields?: DetectedFields): MessageComponentRoot => {
    const descriptionField = fields?.description[0] ?? "description";
    const imageFields = fields?.image ?? [];
    const linkField = fields?.link[0];

    const imagesToUse = imageFields.length > 0 ? imageFields.slice(0, 10) : ["image"];

    const galleryItems: MediaGalleryItemComponent[] = imagesToUse.map((imageField, index) => ({
      type: ComponentType.V2MediaGalleryItem,
      id: `media-gallery-item-${index + 1}`,
      name: `Image ${index + 1}`,
      mediaUrl: `{{${imageField}}}`,
      description: "{{title}}",
      children: [],
    }));

    return {
      type: ComponentType.V2Root,
      id: "media-gallery-root",
      name: "Media Gallery Template",
      placeholderLimits: [
        { placeholder: descriptionField, characterCount: 150, appendString: "..." },
      ],
      stripImages: true,
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
              content: `{{${descriptionField}}}`,
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
              children: galleryItems,
            },
            ...(linkField
              ? [
                  {
                    type: ComponentType.V2ActionRow as const,
                    id: "media-gallery-actions",
                    name: "Actions",
                    children: [
                      {
                        type: ComponentType.V2Button as const,
                        id: "media-gallery-btn",
                        name: "View Button",
                        label: "View",
                        style: DiscordButtonStyle.Link,
                        disabled: false,
                        href: `{{${linkField}}}`,
                      },
                    ],
                  },
                ]
              : []),
          ],
        },
      ],
    };
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
