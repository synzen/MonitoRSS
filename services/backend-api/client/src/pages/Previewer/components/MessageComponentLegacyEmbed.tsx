import { FaStickyNote } from "react-icons/fa";
import MessageBuilderComponent from "./base";
import { DiscordComponentType } from "../constants/DiscordComponentType";

interface LegacyEmbedData {
  color?: number;
}

class MessageComponentLegacyEmbed extends MessageBuilderComponent<LegacyEmbedData> {
  type = DiscordComponentType.LegacyEmbed;

  label = "Embed";

  icon = FaStickyNote;
}

export default MessageComponentLegacyEmbed;
