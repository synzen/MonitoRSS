import { UpdateDiscordChannelConnectionInput } from "../../../features/feedConnections";
import { ComponentType, LegacyMessageComponentRoot, LegacyTextComponent } from "../types";

const convertPreviewerStateToConnectionUpdate = (
  component?: LegacyMessageComponentRoot
): UpdateDiscordChannelConnectionInput["details"] => {
  if (!component) return {};

  const details: UpdateDiscordChannelConnectionInput["details"] = {};

  const textComponent = component.children?.find((c) => c.type === ComponentType.LegacyText);

  if (textComponent) {
    details.content = (textComponent as LegacyTextComponent).content;
  }

  // Handle embeds from LegacyEmbedContainerComponent
  const embedContainer = component.children?.find((c: any) => c.type === "Legacy Embed Container");

  if (embedContainer) {
    details.embeds = embedContainer.children?.map((embed: any) => {
      const embedDetails: any = {};

      if (embed.color) {
        embedDetails.color = embed.color.toString(16).padStart(6, "0");
      }

      // Handle author
      const author = embed.children?.find((c: any) => c.type === "Embed Author");

      if (author) {
        embedDetails.author = {
          name: author.authorName,
          url: author.authorUrl,
          iconUrl: author.authorIconUrl,
        };
      }

      // Handle title
      const title = embed.children?.find((c: any) => c.type === "Embed Title");

      if (title) {
        embedDetails.title = title.title;
        embedDetails.url = title.titleUrl;
      }

      // Handle description
      const description = embed.children?.find((c: any) => c.type === "Embed Description");

      if (description) {
        embedDetails.description = description.description;
      }

      // Handle fields
      const fields = embed.children?.filter((c: any) => c.type === "Embed Field");

      if (fields?.length) {
        embedDetails.fields = fields.map((field: any) => ({
          name: field.fieldName,
          value: field.fieldValue,
          inline: field.inline,
        }));
      }

      // Handle image
      const image = embed.children?.find((c: any) => c.type === "Embed Image");

      if (image) {
        embedDetails.image = { url: image.imageUrl };
      }

      // Handle thumbnail
      const thumbnail = embed.children?.find((c: any) => c.type === "Embed Thumbnail");

      if (thumbnail) {
        embedDetails.thumbnail = { url: thumbnail.thumbnailUrl };
      }

      // Handle footer
      const footer = embed.children?.find((c: any) => c.type === "Embed Footer");

      if (footer) {
        embedDetails.footer = {
          text: footer.footerText,
          iconUrl: footer.footerIconUrl,
        };
      }

      // Handle timestamp
      const timestamp = embed.children?.find((c: any) => c.type === "Embed Timestamp");

      if (timestamp) {
        embedDetails.timestamp = timestamp.timestamp;
      }

      return embedDetails;
    });
  }

  // Handle action rows
  const actionRows = component.children?.filter((c: any) => c.type === "Legacy Action Row");

  if (actionRows?.length) {
    details.componentRows = actionRows.map((row: any, rowIndex: number) => ({
      id: row.id || `row-${rowIndex}`,
      components:
        row.children?.map((button: any, buttonIndex: number) => {
          let style = 1;

          switch (button.style) {
            case "Primary":
              style = 1;
              break;
            case "Secondary":
              style = 2;
              break;
            case "Success":
              style = 3;
              break;
            case "Danger":
              style = 4;
              break;
            case "Link":
              style = 5;
              break;
            default:
              style = 1;
          }

          return {
            id: button.id || `button-${rowIndex}-${buttonIndex}`,
            type: 2, // Button type
            label: button.label,
            style,
            url: button.url,
          };
        }) || [],
    }));
  }

  // Handle formatter options
  if (component.formatTables !== undefined) {
    details.formatter = {
      ...details.formatter,
      formatTables: component.formatTables,
    };
  }

  if (component.stripImages !== undefined) {
    details.formatter = {
      ...details.formatter,
      stripImages: component.stripImages,
    };
  }

  if (component.ignoreNewLines !== undefined) {
    details.formatter = {
      ...details.formatter,
      ignoreNewLines: component.ignoreNewLines,
    };
  }

  // Handle forum options
  if (component.forumThreadTitle) {
    details.forumThreadTitle = component.forumThreadTitle;
  }

  if (component.forumThreadTags) {
    details.forumThreadTags = component.forumThreadTags;
  }

  // Handle mentions
  if (component.mentions) {
    details.mentions = component.mentions;
  }

  // Handle placeholder limits
  if (component.placeholderLimits) {
    details.placeholderLimits = component.placeholderLimits;
  }

  return details;
};

export default convertPreviewerStateToConnectionUpdate;
