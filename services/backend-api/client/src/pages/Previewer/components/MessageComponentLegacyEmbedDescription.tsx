import { FaAlignLeft } from "react-icons/fa";
import MessageBuilderComponent from "./base";
import { DiscordComponentType } from "../constants/DiscordComponentType";

interface LegacyEmbedDescriptionData {
  description?: string;
}

class MessageComponentLegacyEmbedDescription extends MessageBuilderComponent<LegacyEmbedDescriptionData> {
  type = DiscordComponentType.LegacyEmbedDescription;

  label = "Description";

  icon = FaAlignLeft;
}

export default MessageComponentLegacyEmbedDescription;
