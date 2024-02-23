import { ModelDefinition, Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types, Model, Schema as MongooseSchema } from "mongoose";
import {
  FeedConnections,
  FeedConnectionSchema,
} from "../../feeds/entities/feed-connections.entity";
import { UserFeedDisabledCode, UserFeedHealthStatus } from "../types";
import {
  UserFeedDateCheckOptions,
  UserFeedDateCheckOptionsSchema,
} from "./user-feed-date-check-options.entity";
import {
  UserFeedFormatOptions,
  UserFeedFormatOptionsSchema,
} from "./user-feed-format-options.entity";
import {
  UserFeedShareManageOptions,
  UserFeedShareManageOptionsSchema,
} from "./user-feed-share-manage-options.entity";
import { UserFeedUser, UserFeedUserSchema } from "./user-feed-user.entity";

@Schema({
  timestamps: true,
  autoIndex: true,
})
export class UserFeed {
  _id: Types.ObjectId;

  @Prop({
    required: true,
  })
  title: string;

  @Prop({
    required: true,
  })
  url: string;

  @Prop({
    enum: Object.values(UserFeedDisabledCode),
    required: false,
  })
  disabledCode?: UserFeedDisabledCode;

  @Prop({
    type: [String],
    required: false,
  })
  passingComparisons?: string[];

  @Prop({
    type: [String],
    required: false,
  })
  blockingComparisons?: string[];

  @Prop({
    enum: Object.values(UserFeedHealthStatus),
    required: true,
    default: UserFeedHealthStatus.Ok,
  })
  healthStatus: UserFeedHealthStatus;

  @Prop({
    type: FeedConnectionSchema,
    required: false,
    default: {},
  })
  connections: FeedConnections;

  @Prop({
    required: true,
    schema: UserFeedUserSchema,
  })
  user: UserFeedUser;

  @Prop({
    required: false,
    schema: UserFeedFormatOptionsSchema,
  })
  formatOptions?: UserFeedFormatOptions;

  @Prop({
    required: false,
    schema: UserFeedDateCheckOptionsSchema,
  })
  dateCheckOptions?: UserFeedDateCheckOptions;

  @Prop({
    schema: UserFeedShareManageOptionsSchema,
    required: false,
  })
  shareManageOptions?: UserFeedShareManageOptions;

  @Prop({
    required: false,
    type: MongooseSchema.Types.ObjectId,
  })
  legacyFeedId?: Types.ObjectId;

  @Prop({
    required: false,
  })
  refreshRateSeconds?: number;

  @Prop({
    required: false,
  })
  maxDailyArticles?: number;

  @Prop({
    required: false,
    index: true,
  })
  userRefreshRateSeconds?: number;

  @Prop({
    required: false,
  })
  allowLegacyReversion?: boolean;

  @Prop({
    required: false,
  })
  debug?: boolean;

  @Prop({
    required: false,
  })
  feedRequestLookupKey?: string;

  @Prop({
    required: false,
  })
  lastManualRequestAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

export type UserFeedDocument = UserFeed & Document;
export type UserFeedModel = Model<UserFeedDocument>;

export const UserFeedSchema = SchemaFactory.createForClass(UserFeed);

UserFeedSchema.index(
  {
    feedRequestLookupKey: 1,
  },
  {
    unique: true,
    sparse: true,
  }
);

export const UserFeedFeature: ModelDefinition = {
  name: UserFeed.name,
  schema: UserFeedSchema,
};
