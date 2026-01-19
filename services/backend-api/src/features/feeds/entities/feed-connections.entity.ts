import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { FeedConnectionTypeEntityKey } from "../constants";
import {
  DiscordChannelConnection,
  DiscordChannelConnectionSchema,
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
}

export const FeedConnectionSchema =
  SchemaFactory.createForClass(FeedConnections);
