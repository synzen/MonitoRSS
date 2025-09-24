import { FeedDiscordChannelConnection } from "../../../types";
import MessageComponentLegacyText from "../components/MessageComponentLegacyText";
import MessageComponentLegacyButton from "../components/MessageComponentLegacyButton";
import MessageComponentLegacyActionRow from "../components/MessageComponentLegacyActionRow";
import MessageComponentLegacyEmbed from "../components/MessageComponentLegacyEmbed";
import MessageBuilderComponent from "../components/base";
import MessageComponentLegacyEmbedAuthor from "../components/MessageComponentLegacyEmbedAuthor";
import MessageComponentLegacyEmbedTitle from "../components/MessageComponentLegacyEmbedTitle";
import MessageComponentLegacyEmbedDescription from "../components/MessageComponentLegacyEmbedDescription";
import MessageComponentLegacyEmbedField from "../components/MessageComponentLegacyEmbedField";
import MessageComponentLegacyEmbedImage from "../components/MessageComponentLegacyEmbedImage";
import MessageComponentLegacyEmbedThumbnail from "../components/MessageComponentLegacyEmbedThumbnail";
import MessageComponentLegacyEmbedFooter from "../components/MessageComponentLegacyEmbedFooter";
import MessageComponentLegacyEmbedTimestamp from "../components/MessageComponentLegacyEmbedTimestamp";
import MessageComponentLegacyRoot from "../components/MessageComponentLegacyRoot";
import PreviewerFormState from "../types/PreviewerFormState";

const createLegacyTextComponent = (content: string): MessageComponentLegacyText =>
  new MessageComponentLegacyText([], { content });

const createLegacyButtonComponent = (
  button: Exclude<
    FeedDiscordChannelConnection["details"]["componentRows"],
    undefined
  >[number]["components"][number]
): MessageComponentLegacyButton =>
  new MessageComponentLegacyButton([], {
    buttonLabel: button.label,
    style: mapDiscordButtonStyle(button.style),
    disabled: false,
    url: button.url,
  });

const createLegacyActionRowComponent = (
  row: Exclude<FeedDiscordChannelConnection["details"]["componentRows"], undefined>[number]
): MessageComponentLegacyActionRow => {
  const children: MessageComponentLegacyButton[] = [];

  if (row.components && row.components.length > 0) {
    row.components.forEach((button: any) => {
      children.push(createLegacyButtonComponent(button));
    });
  }

  return new MessageComponentLegacyActionRow(children);
};

const mapDiscordButtonStyle = (discordStyle: number): any => {
  // Map Discord button styles to our ButtonStyle enum
  switch (discordStyle) {
    case 1:
      return "Primary";
    case 2:
      return "Secondary";
    case 3:
      return "Success";
    case 4:
      return "Danger";
    case 5:
      return "Link";
    default:
      return "Primary";
  }
};

const createLegacyEmbedComponent = (
  embed: FeedDiscordChannelConnection["details"]["embeds"][number]
): MessageComponentLegacyEmbed => {
  const children: MessageBuilderComponent[] = [];
  let color: number | undefined;

  // Convert hex color to number if present
  if (embed.color) {
    color = parseInt(embed.color.replace("#", ""), 16);
  }

  // Add author component if present
  if (embed.author?.name) {
    children.push(
      new MessageComponentLegacyEmbedAuthor([], {
        authorName: embed.author.name,
        authorUrl: embed.author.url,
        authorIconUrl: embed.author.iconUrl,
      })
    );
  }

  // Add title component if present
  if (embed.title) {
    children.push(
      new MessageComponentLegacyEmbedTitle([], {
        title: embed.title,
        titleUrl: embed.url,
      })
    );
  }

  // Add description component if present
  if (embed.description) {
    children.push(
      new MessageComponentLegacyEmbedDescription([], {
        description: embed.description,
      })
    );
  }

  // Add fields if present
  if (embed.fields && embed.fields.length > 0) {
    embed.fields.forEach((field) => {
      children.push(
        new MessageComponentLegacyEmbedField([], {
          fieldName: field.name,
          fieldValue: field.value,
          inline: field.inline || false,
        })
      );
    });
  }

  // Add image component if present
  if (embed.image?.url) {
    children.push(
      new MessageComponentLegacyEmbedImage([], {
        imageUrl: embed.image.url,
      })
    );
  }

  // Add thumbnail component if present
  if (embed.thumbnail?.url) {
    children.push(
      new MessageComponentLegacyEmbedThumbnail([], {
        thumbnailUrl: embed.thumbnail.url,
      })
    );
  }

  // Add footer component if present
  if (embed.footer?.text) {
    children.push(
      new MessageComponentLegacyEmbedFooter([], {
        footerText: embed.footer.text,
        footerIconUrl: embed.footer.iconUrl,
      })
    );
  }

  // Add timestamp component if present
  if (embed.timestamp) {
    children.push(
      new MessageComponentLegacyEmbedTimestamp([], {
        timestamp: embed.timestamp,
      })
    );
  }

  return new MessageComponentLegacyEmbed(children, { color });
};

export const convertConnectionToPreviewerState = (
  connection: FeedDiscordChannelConnection | null | undefined
): PreviewerFormState => {
  if (!connection?.details) {
    return {};
  }

  const { content, embeds, componentRows } = connection.details;

  // Check if there's any message content to convert
  const hasContent =
    !!content || (embeds && embeds.length > 0) || (componentRows && componentRows.length > 0);

  if (!hasContent) {
    return {};
  }

  const children: MessageBuilderComponent[] = [];

  // Add text content if present
  if (content) {
    children.push(createLegacyTextComponent(content));
  }

  // Add embed components if present
  if (embeds && embeds.length > 0) {
    embeds.forEach((embed) => {
      children.push(createLegacyEmbedComponent(embed));
    });
  }

  // Add action row components if present
  if (componentRows && componentRows.length > 0) {
    componentRows.forEach((row) => {
      children.push(createLegacyActionRowComponent(row));
    });
  }

  // Create a legacy root component that contains the existing message data
  const legacyRootComponent = new MessageComponentLegacyRoot(children);

  return {
    messageComponent: legacyRootComponent,
  };
};
