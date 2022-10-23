import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import {
  DiscordChannelConnection,
  DiscordChannelConnectionSchema,
  DiscordWebhookConnection,
  DiscordWebhookConnectionSchema,
} from "./feed-connections";

@Schema({
  timestamps: false,
  _id: false,
  versionKey: false,
})
export class FeedConnections {
  @Prop({
    type: [DiscordChannelConnectionSchema],
    default: [],
  })
  discordChannels: DiscordChannelConnection[];

  @Prop({
    type: [DiscordWebhookConnectionSchema],
    default: [],
  })
  discordWebhooks: DiscordWebhookConnection[];
}

export const FeedConnectionSchema =
  SchemaFactory.createForClass(FeedConnections);
