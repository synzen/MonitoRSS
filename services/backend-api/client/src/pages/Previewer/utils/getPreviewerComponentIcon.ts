import {
  FaEnvelope,
  FaClipboard,
  FaFile,
  FaHandPointer,
  FaFont,
  FaLayerGroup,
  FaMinus,
  FaStickyNote,
  FaUser,
  FaHeading,
  FaAlignLeft,
  FaImage,
  FaTh,
  FaClock,
} from "react-icons/fa";
import type { Component } from "../types";
import { ComponentType } from "../types";

const getPreviewerComponentIcon = (type: Component["type"]) => {
  switch (type) {
    case ComponentType.LegacyRoot:
      return FaEnvelope;
    case ComponentType.LegacyText:
      return FaFont;
    case ComponentType.LegacyEmbed:
      return FaStickyNote;
    case ComponentType.LegacyEmbedAuthor:
      return FaUser;
    case ComponentType.LegacyEmbedTitle:
      return FaHeading;
    case ComponentType.LegacyEmbedDescription:
      return FaAlignLeft;
    case ComponentType.LegacyEmbedImage:
      return FaImage;
    case ComponentType.LegacyEmbedThumbnail:
      return FaTh;
    case ComponentType.LegacyEmbedFooter:
      return FaMinus;
    case ComponentType.LegacyEmbedField:
      return FaFile;
    case ComponentType.LegacyEmbedTimestamp:
      return FaClock;
    case ComponentType.V2Root:
      return FaEnvelope;
    case ComponentType.V2TextDisplay:
      return FaFont;
    case ComponentType.V2ActionRow:
      return FaClipboard;
    case ComponentType.V2Button:
      return FaHandPointer;
    case ComponentType.V2Section:
      return FaLayerGroup;
    case ComponentType.V2Divider:
      return FaMinus;
    default:
      return FaFile;
  }
};

export default getPreviewerComponentIcon;
