import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { FeedConnectionTypeEntityKey } from "../constants";
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
  [FeedConnectionTypeEntityKey.DiscordChannels]: DiscordChannelConnection[];

  @Prop({
    type: [DiscordWebhookConnectionSchema],
    default: [],
  })
  [FeedConnectionTypeEntityKey.DiscordWebhooks]: DiscordWebhookConnection[];
}

export const FeedConnectionSchema =
  SchemaFactory.createForClass(FeedConnections);
