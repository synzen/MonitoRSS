import { FaFile } from "react-icons/fa";
import MessageBuilderComponent from "./base";
import { DiscordComponentType } from "../constants/DiscordComponentType";

interface LegacyEmbedFieldData {
  fieldName?: string;
  fieldValue?: string;
  inline?: boolean;
}

class MessageComponentLegacyEmbedField extends MessageBuilderComponent<LegacyEmbedFieldData> {
  type = DiscordComponentType.LegacyEmbedField;

  label = "Field";

  icon = FaFile;
}

export default MessageComponentLegacyEmbedField;
