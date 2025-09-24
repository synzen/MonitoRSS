import { FaMinus } from "react-icons/fa";
import MessageBuilderComponent from "./base";
import { DiscordComponentType } from "../constants/DiscordComponentType";

interface V2DividerData {
  visual?: boolean;
  spacing?: 1 | 2;
}

class MessageComponentV2Divider extends MessageBuilderComponent<V2DividerData> {
  type = DiscordComponentType.V2Divider;

  label = "Divider";

  icon = FaMinus;

  data: V2DividerData = { visual: true, spacing: 1 as 1 | 2 };
}

export default MessageComponentV2Divider;
