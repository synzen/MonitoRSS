import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { FeedEmbed, FeedEmbedSchema } from "../feed-embed.entity";

@Schema({
  _id: false,
  timestamps: false,
})
class Channel {
  @Prop({
    required: true,
  })
  id: string;
}

@Schema({
  timestamps: false,
  _id: false,
})
export class DiscordChannelConnectionDetails {
  @Prop({
    type: [FeedEmbedSchema],
    default: [],
  })
  embeds: FeedEmbed[];

  @Prop({
    type: Channel,
    required: true,
  })
  channel: Channel;

  @Prop({
    type: String,
    required: false,
  })
  content?: string;
}

export const DiscordChannelConnectionDetailsSchema =
  SchemaFactory.createForClass(DiscordChannelConnectionDetails);
