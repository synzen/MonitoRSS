import React from "react";
import { FiHash, FiMessageCircle } from "react-icons/fi";
import { BsMegaphoneFill, BsVolumeUpFill } from "react-icons/bs";

export type ChannelIconType = "text" | "voice" | "forum" | "announcement";

interface GetChannelIconOptions {
  className?: string;
  size?: number;
}

export const getChannelIcon = (
  channelType?: ChannelIconType | string | null,
  options: GetChannelIconOptions = {},
): React.ReactNode => {
  const { className, size } = options;
  const iconProps = { className, size };

  switch (channelType) {
    case "voice":
      return <BsVolumeUpFill {...iconProps} />;
    case "forum":
      return <FiMessageCircle {...iconProps} />;
    case "announcement":
      return <BsMegaphoneFill {...iconProps} />;
    case "text":
    default:
      return <FiHash {...iconProps} />;
  }
};
