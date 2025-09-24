import MessageBuilderComponent from "../components/base";
import MessageComponentLegacyActionRow from "../components/MessageComponentLegacyActionRow";
import MessageComponentLegacyButton from "../components/MessageComponentLegacyButton";
import MessageComponentLegacyEmbed from "../components/MessageComponentLegacyEmbed";
import MessageComponentLegacyEmbedAuthor from "../components/MessageComponentLegacyEmbedAuthor";
import MessageComponentLegacyEmbedDescription from "../components/MessageComponentLegacyEmbedDescription";
import MessageComponentLegacyEmbedField from "../components/MessageComponentLegacyEmbedField";
import MessageComponentLegacyEmbedFooter from "../components/MessageComponentLegacyEmbedFooter";
import MessageComponentLegacyEmbedImage from "../components/MessageComponentLegacyEmbedImage";
import MessageComponentLegacyEmbedThumbnail from "../components/MessageComponentLegacyEmbedThumbnail";
import MessageComponentLegacyEmbedTimestamp from "../components/MessageComponentLegacyEmbedTimestamp";
import MessageComponentLegacyEmbedTitle from "../components/MessageComponentLegacyEmbedTitle";
import MessageComponentV2ActionRow from "../components/MessageComponentV2ActionRow";
import MessageComponentV2Button from "../components/MessageComponentV2Button";
import MessageComponentV2Divider from "../components/MessageComponentV2Divider";
import MessageComponentV2Root from "../components/MessageComponentV2Root";
import MessageComponentV2Section from "../components/MessageComponentV2Section";
import MessageComponentV2TextDisplay from "../components/MessageComponentV2TextDisplay";
import { DiscordButtonStyle } from "../constants/DiscordButtonStyle";
import { DiscordComponentType } from "../constants/DiscordComponentType";

const createNewPreviewerComponent = (type: DiscordComponentType): MessageBuilderComponent => {
  switch (type) {
    case DiscordComponentType.LegacyText:
      return new MessageComponentV2TextDisplay();
    case DiscordComponentType.LegacyEmbed:
      return new MessageComponentLegacyEmbed();
    case DiscordComponentType.LegacyEmbedAuthor:
      return new MessageComponentLegacyEmbedAuthor();
    case DiscordComponentType.LegacyEmbedTitle:
      return new MessageComponentLegacyEmbedTitle();
    case DiscordComponentType.LegacyEmbedDescription:
      return new MessageComponentLegacyEmbedDescription();
    case DiscordComponentType.LegacyEmbedImage:
      return new MessageComponentLegacyEmbedImage();
    case DiscordComponentType.LegacyEmbedThumbnail:
      return new MessageComponentLegacyEmbedThumbnail();
    case DiscordComponentType.LegacyEmbedFooter:
      return new MessageComponentLegacyEmbedFooter();
    case DiscordComponentType.LegacyEmbedField:
      return new MessageComponentLegacyEmbedField();
    case DiscordComponentType.LegacyEmbedTimestamp:
      return new MessageComponentLegacyEmbedTimestamp();
    case DiscordComponentType.LegacyActionRow:
      return new MessageComponentLegacyActionRow();
    case DiscordComponentType.LegacyButton:
      return new MessageComponentLegacyButton([], {
        buttonLabel: "New Button",
        style: DiscordButtonStyle.Primary,
        disabled: false,
      });
    case DiscordComponentType.V2Root:
      return new MessageComponentV2Root();
    case DiscordComponentType.V2TextDisplay:
      return new MessageComponentV2TextDisplay([], {
        content: "Hello, Discord!",
      });
    case DiscordComponentType.V2ActionRow:
      return new MessageComponentV2ActionRow();
    case DiscordComponentType.V2Button:
      return new MessageComponentV2Button([], {
        buttonLabel: "New Button",
        style: DiscordButtonStyle.Primary,
        disabled: false,
      });
    case DiscordComponentType.V2Section:
      return new MessageComponentV2Section();
    case DiscordComponentType.V2Divider:
      return new MessageComponentV2Divider([], {
        visual: true,
        spacing: 1,
      });
    default:
      throw new Error(`Unknown child type: ${type}`);
  }
};

export default createNewPreviewerComponent;
