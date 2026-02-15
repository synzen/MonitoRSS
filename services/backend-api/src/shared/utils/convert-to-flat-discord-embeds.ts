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
    authorIconURL: embed.author?.iconUrl ?? undefined,
    authorName: embed.author?.name ?? undefined,
    authorURL: embed.author?.url ?? undefined,
    fields: embed.fields?.map((field) => ({
      name: field.name ?? "",
      value: field.value ?? "",
      inline: field.inline ?? undefined,
    })),
    footerIconURL: embed.footer?.iconUrl ?? undefined,
    footerText: embed.footer?.text ?? undefined,
    imageURL: embed.image?.url ?? undefined,
    thumbnailURL: embed.thumbnail?.url ?? undefined,
  }));
}
