import type { Static } from "@sinclair/typebox";
import type { IFeedEmbed } from "../../repositories/interfaces/feed-embed.types";
import type { EmbedSchema } from "../schemas/discord-embed.schemas";

type NestedEmbed = Static<typeof EmbedSchema>;

export function convertToFlatDiscordEmbeds(
  embeds?: NestedEmbed[] | null,
): IFeedEmbed[] | undefined {
  if (!embeds) {
    return undefined;
  }

  return embeds.map((embed) => ({
    title: embed.title ?? undefined,
    description: embed.description ?? undefined,
    url: embed.url ?? undefined,
    timestamp: embed.timestamp ?? undefined,
    color: embed.color ?? undefined,
    authorIconURL: embed.author?.iconUrl,
    authorName: embed.author?.name,
    authorURL: embed.author?.url,
    fields: embed.fields?.map((field) => ({
      name: field.name,
      value: field.value,
      inline: field.inline ?? undefined,
    })),
    footerIconURL: embed.footer?.iconUrl,
    footerText: embed.footer?.text,
    imageURL: embed.image?.url,
    thumbnailURL: embed.thumbnail?.url,
  }));
}
