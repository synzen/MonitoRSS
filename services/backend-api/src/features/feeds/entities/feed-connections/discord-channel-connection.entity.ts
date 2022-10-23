import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Types, Schema as MongooseSchema } from "mongoose";
import { FeedEmbed, FeedEmbedSchema } from "../feed-embed.entity";

@Schema({
  _id: false,
  timestamps: false,
  versionKey: false,
})
class Channel {
  @Prop({
    required: true,
  })
  id: string;
}

const ChannelSchema = SchemaFactory.createForClass(Channel);

@Schema({
  _id: false,
  versionKey: false,
  timestamps: false,
})
class Details {
  @Prop({
    type: [FeedEmbedSchema],
    default: [],
  })
  embeds: FeedEmbed[];

  @Prop({
    type: ChannelSchema,
    required: true,
  })
  channel: Channel;

  @Prop({
    type: String,
    required: false,
  })
  content?: string;
}

const DetailsSchema = SchemaFactory.createForClass(Details);

@Schema({
  _id: false,
  timestamps: true,
  versionKey: false,
})
export class DiscordChannelConnection {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    default: () => new Types.ObjectId(),
  })
  id: Types.ObjectId;

  @Prop({
    required: true,
  })
  name: string;

  @Prop({
    type: DetailsSchema,
    required: true,
  })
  details: Details;

  createdAt: Date;
  updatedAt: Date;
}

export const DiscordChannelConnectionSchema = SchemaFactory.createForClass(
  DiscordChannelConnection
);
