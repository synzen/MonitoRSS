import { FaFont } from "react-icons/fa";
import MessageBuilderComponent from "./base";
import { DiscordComponentType } from "../constants/DiscordComponentType";

interface LegacyTextData {
  content: string;
}

class MessageComponentLegacyText extends MessageBuilderComponent<LegacyTextData> {
  type = DiscordComponentType.LegacyText;

  label = "Text";

  icon = FaFont;

  data: LegacyTextData = { content: "" };
}

export default MessageComponentLegacyText;
