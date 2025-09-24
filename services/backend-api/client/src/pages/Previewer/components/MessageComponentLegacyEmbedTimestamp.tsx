import { FaClock } from "react-icons/fa";
import MessageBuilderComponent from "./base";
import { DiscordComponentType } from "../constants/DiscordComponentType";

interface LegacyEmbedTimestampData {
  timestamp?: "article" | "now" | "";
}

class MessageComponentLegacyEmbedTimestamp extends MessageBuilderComponent<LegacyEmbedTimestampData> {
  type = DiscordComponentType.LegacyEmbedTimestamp;

  label = "Timestamp";

  icon = FaClock;
}

export default MessageComponentLegacyEmbedTimestamp;
