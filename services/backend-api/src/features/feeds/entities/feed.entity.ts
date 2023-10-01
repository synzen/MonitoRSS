import { ModelDefinition, Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types, Model } from "mongoose";
import {
  FeedConnections,
  FeedConnectionSchema,
} from "./feed-connections.entity";
import { FeedEmbed, FeedEmbedSchema } from "./feed-embed.entity";
import { FeedRegexOp, FeedRegexOpSchema } from "./feed-regexop.entity";
import { FeedWebhook, FeedWebhookSchema } from "./feed-webhook.entity";

@Schema({
  _id: false,
})
class FeedSplitOptions {
  @Prop()
  enabled?: boolean;

  @Prop()
  char?: boolean;

  @Prop()
  prepend?: boolean;

  @Prop()
  append?: boolean;

  @Prop()
  maxLength?: boolean;
}

@Schema({
  collection: "feeds",
  timestamps: true,
})
export class Feed {
  _id: Types.ObjectId;

  @Prop({
    required: false,
  })
  text?: string;

  @Prop({
    required: true,
  })
  title: string;

  @Prop({
    required: true,
  })
  url: string;

  @Prop({
    required: true,
  })
  guild: string;

  @Prop({
    required: true,
  })
  channel: string;

  @Prop({
    type: Map,
    of: [String],
  })
  filters?: Record<string, string[]>;

  @Prop({
    type: Map,
    of: String,
  })
  rfilters?: Record<string, string>;

  @Prop({
    type: [FeedEmbedSchema],
    default: [],
  })
  embeds: FeedEmbed[];

  @Prop()
  disabled?: string;

  @Prop()
  checkTitles?: boolean;

  @Prop()
  checkDates?: boolean;

  @Prop()
  imgPreviews?: boolean;

  @Prop()
  imgLinksExistence?: boolean;

  @Prop()
  formatTables?: boolean;

  @Prop()
  directSubscribers?: boolean;

  @Prop({
    type: [String],
    default: [],
  })
  ncomparisons?: string[];

  @Prop({
    type: [String],
    default: [],
  })
  pcomparisons?: string[];

  @Prop({
    type: FeedWebhookSchema,
  })
  webhook?: FeedWebhook;

  @Prop({
    default: Date.now,
  })
  addedAt: Date;

  @Prop({
    type: FeedSplitOptions,
  })
  split?: FeedSplitOptions;

  @Prop({
    type: Map,
    of: [FeedRegexOpSchema],
  })
  regexOps?: Record<string, FeedRegexOp[]>;

  @Prop()
  isFeedv2?: boolean;

  @Prop({
    type: FeedConnectionSchema,
    required: false,
    default: {},
  })
  connections?: FeedConnections;

  createdAt?: Date;

  updatedAt?: Date;
}

export type FeedDocument = Feed & Document;
export type FeedModel = Model<FeedDocument>;
export const FeedSchema = SchemaFactory.createForClass(Feed);
export const FeedFeature: ModelDefinition = {
  name: Feed.name,
  schema: FeedSchema,
};
