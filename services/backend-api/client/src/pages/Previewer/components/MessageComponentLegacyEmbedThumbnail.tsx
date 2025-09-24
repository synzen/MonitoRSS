import { FaTh } from "react-icons/fa";
import MessageBuilderComponent from "./base";
import { DiscordComponentType } from "../constants/DiscordComponentType";

interface LegacyEmbedThumbnailData {
  thumbnailUrl?: string;
}

class MessageComponentLegacyEmbedThumbnail extends MessageBuilderComponent<LegacyEmbedThumbnailData> {
  type = DiscordComponentType.LegacyEmbedThumbnail;

  label = "Thumbnail";

  icon = FaTh;
}

export default MessageComponentLegacyEmbedThumbnail;
