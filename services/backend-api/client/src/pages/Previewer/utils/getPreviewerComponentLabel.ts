import { ComponentType } from "../types";

const componentLabels: Partial<Record<ComponentType, string>> = {
  [ComponentType.LegacyText]: "Custom Text",
  [ComponentType.LegacyEmbedContainer]: "Embeds",
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
};

const getPreviewerComponentLabel = (type: ComponentType) => {
  return componentLabels[type] || type;
};

export default getPreviewerComponentLabel;
