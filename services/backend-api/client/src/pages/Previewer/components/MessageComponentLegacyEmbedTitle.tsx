import { FaHeading } from "react-icons/fa";
import MessageBuilderComponent from "./base";
import { DiscordComponentType } from "../constants/DiscordComponentType";

interface LegacyEmbedTitleData {
  title?: string | null;
  titleUrl?: string | null;
}

class MessageComponentLegacyEmbedTitle extends MessageBuilderComponent<LegacyEmbedTitleData> {
  type = DiscordComponentType.LegacyEmbedTitle;

  label = "Title";

  icon = FaHeading;
}

export default MessageComponentLegacyEmbedTitle;
