import { FaClipboard } from "react-icons/fa";
import MessageBuilderComponent from "./base";
import { DiscordComponentType } from "../constants/DiscordComponentType";

class MessageComponentLegacyActionRow extends MessageBuilderComponent {
  type = DiscordComponentType.LegacyActionRow;

  label = "Action Row";

  icon = FaClipboard;

  clone() {
    return new MessageComponentLegacyActionRow(this.children?.map((c) => c.clone()));
  }
}

export default MessageComponentLegacyActionRow;
