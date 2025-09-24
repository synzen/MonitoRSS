import { FaLayerGroup } from "react-icons/fa";
import { DiscordComponentType } from "../constants/DiscordComponentType";
import type MessageComponentV2Button from "./MessageComponentV2Button";
import MessageBuilderComponent from "./base";

class MessageComponentV2Section extends MessageBuilderComponent {
  type = DiscordComponentType.V2Section;

  label = "Section";

  icon = FaLayerGroup;

  accessory: MessageComponentV2Button | null = null;
}

export default MessageComponentV2Section;
