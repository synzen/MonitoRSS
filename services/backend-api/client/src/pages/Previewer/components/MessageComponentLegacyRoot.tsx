import { FaEnvelope } from "react-icons/fa";
import { DiscordComponentType } from "../constants/DiscordComponentType";
import MessageBuilderComponent from "./base";

class MessageComponentLegacyRoot extends MessageBuilderComponent {
  type = DiscordComponentType.LegacyRoot;

  label = "Discord Message";

  icon = FaEnvelope;
}

export default MessageComponentLegacyRoot;
