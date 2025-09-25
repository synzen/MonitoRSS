import { ComponentType } from "../types";

const getPreviewerComponentLabel = (type: ComponentType) => {
  switch (type) {
    case ComponentType.LegacyText:
      return "Text";
    case ComponentType.LegacyEmbedContainer:
      return "Embeds";
    case ComponentType.LegacyEmbed:
      return "Embed";
    case ComponentType.LegacyEmbedAuthor:
      return "Author";
    case ComponentType.LegacyEmbedTitle:
      return "Title";
    case ComponentType.LegacyEmbedDescription:
      return "Description";
    case ComponentType.LegacyEmbedImage:
      return "Image";
    case ComponentType.LegacyEmbedThumbnail:
      return "Thumbnail";
    case ComponentType.LegacyEmbedFooter:
      return "Footer";
    case ComponentType.LegacyEmbedField:
      return "Field";
    case ComponentType.LegacyEmbedTimestamp:
      return "Timestamp";
    case ComponentType.LegacyActionRow:
      return "Action Row";
    case ComponentType.LegacyButton:
      return "Button";
    case ComponentType.LegacyRoot:
      return "Discord Message";
    default:
      return type;
  }
};

export default getPreviewerComponentLabel;
