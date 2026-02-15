import { randomUUID } from "crypto";
import type { IFeedEmbed } from "../../repositories/interfaces/feed-embed.types";

export function convertToNestedDiscordEmbed(embeds?: IFeedEmbed[]) {
  if (!embeds) {
    return [];
  }

  return embeds.map((embed) => ({
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
    fields: embed.fields?.map((field) => ({
      ...field,
      id: randomUUID(),
      inline: !!field.inline,
    })),
  }));
}
