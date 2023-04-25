import { DiscordEmbed } from "../common";
import { FeedEmbed } from "../features/feeds/entities/feed-embed.entity";

export const convertToNestedDiscordEmbed = (
  embeds?: FeedEmbed[]
): DiscordEmbed[] => {
  if (!embeds) {
    return [];
  }

  return embeds.map((embed) => {
    return {
      ...embed,
      author: embed.authorName
        ? {
            name: embed.authorName,
            url: embed.authorURL,
            iconUrl: embed.authorIconURL,
          }
        : undefined,
      footer: embed.footerText
        ? {
            text: embed.footerText,
            iconUrl: embed.footerIconURL,
          }
        : undefined,
      thumbnail: embed.thumbnailURL
        ? {
            url: embed.thumbnailURL,
          }
        : undefined,
      image: embed.imageURL
        ? {
            url: embed.imageURL,
          }
        : undefined,
    };
  });
};
