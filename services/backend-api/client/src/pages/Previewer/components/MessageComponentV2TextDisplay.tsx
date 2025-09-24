import { FaFont } from "react-icons/fa";
import MessageBuilderComponent from "./base";
import { DiscordComponentType } from "../constants/DiscordComponentType";

interface V2TextDisplayData {
  content: string;
}

class MessageComponentV2TextDisplay extends MessageBuilderComponent<V2TextDisplayData> {
  type = DiscordComponentType.V2TextDisplay;

  label = "Text Display";

  icon = FaFont;
}

export default MessageComponentV2TextDisplay;
