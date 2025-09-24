import { FaHandPointer } from "react-icons/fa";
import MessageBuilderComponent from "./base";
import { DiscordComponentType } from "../constants/DiscordComponentType";
import { DiscordButtonStyle } from "../constants/DiscordButtonStyle";

interface V2ButtonData {
  buttonLabel: string;
  style: DiscordButtonStyle;
  disabled: boolean;
  href?: string;
}

class MessageComponentV2Button extends MessageBuilderComponent<V2ButtonData> {
  type = DiscordComponentType.V2Button;

  label = "Button";

  icon = FaHandPointer;

  data: V2ButtonData = {
    buttonLabel: "",
    style: DiscordButtonStyle.Primary,
    disabled: false,
    href: "",
  };
}

export default MessageComponentV2Button;
