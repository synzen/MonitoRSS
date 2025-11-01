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
  FaBars,
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

const componentIcons: Partial<Record<ComponentType, any>> = {
  [ComponentType.LegacyRoot]: FaEnvelope,
  [ComponentType.LegacyText]: FaFont,
  [ComponentType.LegacyEmbedContainer]: FaLayerGroup,
  [ComponentType.LegacyEmbed]: LegacyEmbedIcon,
  [ComponentType.LegacyEmbedAuthor]: FaUser,
  [ComponentType.LegacyEmbedTitle]: FaHeading,
  [ComponentType.LegacyEmbedDescription]: FaAlignLeft,
  [ComponentType.LegacyEmbedImage]: FaImage,
  [ComponentType.LegacyEmbedThumbnail]: FaTh,
  [ComponentType.LegacyEmbedFooter]: FaMinus,
  [ComponentType.LegacyEmbedField]: FaBars,
  [ComponentType.LegacyEmbedTimestamp]: FaClock,
  [ComponentType.LegacyActionRow]: FaClipboard,
  [ComponentType.LegacyButton]: FaHandPointer,
  [ComponentType.V2Root]: FaEnvelope,
  [ComponentType.V2TextDisplay]: FaFont,
  [ComponentType.V2ActionRow]: FaClipboard,
  [ComponentType.V2Button]: FaHandPointer,
  [ComponentType.V2Section]: FaLayerGroup,
  [ComponentType.V2Divider]: FaMinus,
};

const getPreviewerComponentIcon = (type: Component["type"]) => {
  return componentIcons[type] || FaFile;
};

export default getPreviewerComponentIcon;
