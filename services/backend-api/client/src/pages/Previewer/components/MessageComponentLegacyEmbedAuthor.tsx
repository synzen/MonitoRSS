import { FaUser } from "react-icons/fa";
import MessageBuilderComponent from "./base";
import { DiscordComponentType } from "../constants/DiscordComponentType";

interface LegacyEmbedAuthorData {
  authorName?: string | null;
  authorUrl?: string | null;
  authorIconUrl?: string | null;
}

class MessageComponentLegacyEmbedAuthor extends MessageBuilderComponent<LegacyEmbedAuthorData> {
  type = DiscordComponentType.LegacyEmbedAuthor;

  label = "Author";

  icon = FaUser;
}

export default MessageComponentLegacyEmbedAuthor;
