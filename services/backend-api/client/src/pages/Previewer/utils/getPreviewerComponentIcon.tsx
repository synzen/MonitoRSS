import {
  FaEnvelope,
  FaClipboard,
  FaFile,
  FaHandPointer,
  FaFont,
  FaLayerGroup,
  FaMinus,
  FaUser,
  FaHeading,
  FaAlignLeft,
  FaImage,
  FaTh,
  FaClock,
} from "react-icons/fa";
import type { Component } from "../types";
import { ComponentType } from "../types";

const LegacyEmbedIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
    style={{ width: "1.25em", height: "1.25em" }}
  >
    <rect
      x="2"
      y="2"
      width="12"
      height="12"
      rx="2"
      ry="2"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <rect x="2" y="2" width="3" height="12" fill="currentColor" />
  </svg>
);

const getPreviewerComponentIcon = (type: Component["type"]) => {
  switch (type) {
    case ComponentType.LegacyRoot:
      return FaEnvelope;
    case ComponentType.LegacyText:
      return FaFont;
    case ComponentType.LegacyEmbedContainer:
      return FaLayerGroup;
    case ComponentType.LegacyEmbed:
      return LegacyEmbedIcon;
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
    case ComponentType.LegacyActionRow:
      return FaClipboard;
    case ComponentType.LegacyButton:
      return FaHandPointer;
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
