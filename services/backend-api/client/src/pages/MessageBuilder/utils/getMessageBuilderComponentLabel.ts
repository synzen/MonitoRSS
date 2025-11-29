import { ComponentType } from "../types";

const componentLabels: Partial<Record<ComponentType, string>> = {
  [ComponentType.LegacyText]: "Custom Text",
  [ComponentType.LegacyEmbedContainer]: "Embeds List",
  [ComponentType.LegacyEmbed]: "Embed",
  [ComponentType.LegacyEmbedAuthor]: "Author",
  [ComponentType.LegacyEmbedTitle]: "Title",
  [ComponentType.LegacyEmbedDescription]: "Description",
  [ComponentType.LegacyEmbedImage]: "Image",
  [ComponentType.LegacyEmbedThumbnail]: "Thumbnail",
  [ComponentType.LegacyEmbedFooter]: "Footer",
  [ComponentType.LegacyEmbedField]: "Field",
  [ComponentType.LegacyEmbedTimestamp]: "Timestamp",
  [ComponentType.LegacyActionRow]: "Action Row",
  [ComponentType.LegacyButton]: "Button",
  [ComponentType.LegacyRoot]: "Discord Message",
  [ComponentType.V2Thumbnail]: "Thumbnail",
  [ComponentType.V2Container]: "Container",
  [ComponentType.V2MediaGallery]: "Media Gallery",
  [ComponentType.V2MediaGalleryItem]: "Gallery Item",
};

const getMessageBuilderComponentLabel = (type: ComponentType) => {
  return componentLabels[type] || type;
};

export default getMessageBuilderComponentLabel;
