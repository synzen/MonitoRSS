import { FeedEmbed } from "../../features/feeds/entities/feed-embed.entity";
import { DiscordMediumEvent } from "../types";

export const castDiscordEmbedsForMedium = (
  embeds?: FeedEmbed[]
): DiscordMediumEvent["details"]["embeds"] => {
  if (!embeds) {
    return [];
  }

  return embeds.map((embed) => ({
    ...(embed.color && { color: Number(embed.color) }),
    ...(embed.authorName && {
      author: {
        name: embed.authorName,
        iconUrl: embed.authorIconURL,
        url: embed.authorURL,
      },
    }),
    ...(embed.footerText && {
      footer: {
        text: embed.footerText,
        iconUrl: embed.footerIconURL,
      },
    }),
    ...(embed.imageURL && {
      image: {
        url: embed.imageURL,
      },
    }),
    ...(embed.thumbnailURL && {
      thumbnail: {
        url: embed.thumbnailURL,
      },
    }),
    ...(embed.title && {
      title: embed.title,
    }),
    ...(embed.url && {
      url: embed.url,
    }),
    ...(embed.description && {
      description: embed.description,
    }),
    fields:
      embed.fields?.map((field) => ({
        name: field.name,
        value: field.value,
        inline: field.inline,
      })) || [],
  }));
};
