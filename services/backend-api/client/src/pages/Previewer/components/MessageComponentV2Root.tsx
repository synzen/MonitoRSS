import { FaEnvelope } from "react-icons/fa";
import MessageBuilderComponent from "./base";
import { DiscordComponentType } from "../constants/DiscordComponentType";

class MessageComponentV2Root extends MessageBuilderComponent {
  type = DiscordComponentType.V2Root;

  label = "Discord Components V2";

  icon = FaEnvelope;
}

export default MessageComponentV2Root;
