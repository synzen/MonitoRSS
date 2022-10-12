import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { FeedConnectionType } from "../../constants";
import { DiscordChannelConnectionDetails } from "./discord-channel-connection-details.entity";
import { DiscordWebhookConnectionDetails } from "./discord-webhook-connection-details.entity";

@Schema({
  _id: false,
  timestamps: true,
  discriminatorKey: "type",
})
export class BaseConnectionDetails {
  @Prop({
    type: String,
    enum: Object.values(FeedConnectionType),
    required: true,
  })
  type: FeedConnectionType;
}

export const BaseConnectionSchema = SchemaFactory.createForClass(
  BaseConnectionDetails
);

BaseConnectionSchema.discriminator(
  FeedConnectionType.DiscordChannel,
  DiscordChannelConnectionDetails
);

BaseConnectionSchema.discriminator(
  FeedConnectionType.DiscordWebhook,
  DiscordWebhookConnectionDetails
);
