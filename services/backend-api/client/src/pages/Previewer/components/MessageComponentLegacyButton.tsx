import { FaHandPointer } from "react-icons/fa";
import MessageBuilderComponent from "./base";
import { DiscordComponentType } from "../constants/DiscordComponentType";
import { DiscordButtonStyle } from "../constants/DiscordButtonStyle";

interface LegacyButtonData {
  buttonLabel: string;
  style: DiscordButtonStyle;
  disabled: boolean;
  url?: string;
}

class MessageComponentLegacyButton extends MessageBuilderComponent<LegacyButtonData> {
  type = DiscordComponentType.LegacyButton;

  label = "Button";

  icon = FaHandPointer;

  data: LegacyButtonData = { buttonLabel: "", style: DiscordButtonStyle.Primary, disabled: false };
}

export default MessageComponentLegacyButton;
