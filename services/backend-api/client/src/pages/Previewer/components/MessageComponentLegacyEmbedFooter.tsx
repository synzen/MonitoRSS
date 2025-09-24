import { FaMinus } from "react-icons/fa";
import MessageBuilderComponent from "./base";
import { DiscordComponentType } from "../constants/DiscordComponentType";

interface LegacyEmbedFooterData {
  footerText?: string | null;
  footerIconUrl?: string | null;
}

class MessageComponentLegacyEmbedFooter extends MessageBuilderComponent<LegacyEmbedFooterData> {
  type = DiscordComponentType.LegacyEmbedFooter;

  label = "Footer";

  icon = FaMinus;
}

export default MessageComponentLegacyEmbedFooter;
