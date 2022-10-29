import { DiscordEmbed } from "../common";
import { Feed } from "../features/feeds/entities/feed.entity";

export const convertToFlatDiscordEmbeds = (
  embeds?: DiscordEmbed[]
): Feed["embeds"] | undefined => {
  if (!embeds) {
    return embeds;
  }

  return embeds.map((embed) => {
    return {
      title: embed.title,
      description: embed.description,
      url: embed.url,
      timestamp: embed.timestamp,
      color: embed.color,
      authorIconURL: embed.author?.iconUrl,
      authorName: embed.author?.name,
      authorURL: embed.author?.url,
      fields: embed.fields?.map((field) => {
        return {
          name: field.name,
          value: field.value,
          inline: field.inline,
        };
      }),
      footerIconURL: embed.footer?.iconUrl,
      footerText: embed.footer?.text,
      imageURL: embed.image?.url,
      thumbnailURL: embed.thumbnail?.url,
    };
  });
};
