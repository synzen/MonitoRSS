import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { FeedConnectionDiscordWebhookType } from "../../constants";

@Schema({
  _id: false,
  versionKey: false,
  timestamps: false,
})
export class DiscordWebhook {
  @Prop({
    required: true,
  })
  id: string;

  @Prop({
    required: false,
  })
  name?: string;

  @Prop({
    required: false,
  })
  iconUrl?: string;

  @Prop({
    required: true,
  })
  token: string;

  @Prop({
    required: true,
  })
  guildId: string;

  @Prop({
    required: false,
    enum: Object.values(FeedConnectionDiscordWebhookType),
    type: String,
  })
  type?: FeedConnectionDiscordWebhookType | null;

  @Prop({
    required: false,
  })
  threadId?: string;

  @Prop({
    required: false,
  })
  channelId?: string;

  @Prop()
  isApplicationOwned?: boolean;
}

export const DiscordWebhookSchema =
  SchemaFactory.createForClass(DiscordWebhook);
