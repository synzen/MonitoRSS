import { FaImage } from "react-icons/fa";
import MessageBuilderComponent from "./base";
import { DiscordComponentType } from "../constants/DiscordComponentType";

interface LegacyEmbedImageData {
  imageUrl?: string;
}

class MessageComponentLegacyEmbedImage extends MessageBuilderComponent<LegacyEmbedImageData> {
  type = DiscordComponentType.LegacyEmbedImage;

  label = "Image";

  icon = FaImage;
}

export default MessageComponentLegacyEmbedImage;
