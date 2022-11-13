import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Types, Schema as MongooseSchema } from "mongoose";
import { FEED_CONNECTION_DISABLED_CODES } from "../../constants";
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

  @Prop({
    required: true,
  })
  guildId: string;
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
  versionKey: false,
  timestamps: false,
})
class Filters {
  @Prop({
    type: MongooseSchema.Types.Mixed,
  })
  expression: Record<string, unknown>;
}

const FiltersSchema = SchemaFactory.createForClass(Filters);

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
    enum: Object.values(FEED_CONNECTION_DISABLED_CODES),
    required: false,
  })
  disabledCode?: string;

  @Prop({
    type: FiltersSchema,
    required: false,
  })
  filters?: Filters;

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
