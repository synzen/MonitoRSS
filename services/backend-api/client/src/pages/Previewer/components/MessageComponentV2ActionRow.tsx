import { FaClipboard } from "react-icons/fa";
import MessageBuilderComponent from "./base";
import { DiscordComponentType } from "../constants/DiscordComponentType";

class MessageComponentV2ActionRow extends MessageBuilderComponent {
  type = DiscordComponentType.V2ActionRow;

  label = "Action Row";

  icon = FaClipboard;
}

export default MessageComponentV2ActionRow;
