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
import {
  ExternalFeedProperty,
  ExternalFeedPropertySchema,
} from "./external-feed-property.entity";

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
    required: false,
  })
  inputUrl?: string;

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
    type: [ExternalFeedPropertySchema],
    required: false,
  })
  externalProperties?: Array<ExternalFeedProperty>;

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
  })
  userRefreshRateSeconds?: number;

  /**
   * Determines when this feed is fetched within its refresh interval.
   *
   * Calculated as: fnv1aHash(url) % (refreshRateSeconds * 1000)
   *
   * This enables staggered fetching - instead of all feeds with the same
   * refresh rate being fetched at once, each feed is assigned to a time
   * slot within the interval. The scheduler queries feeds in 60-second
   * windows based on this offset.
   *
   * Example: For a 20-minute interval, a feed with slotOffsetMs = 300000
   * will be fetched 5 minutes into each 20-minute cycle.
   */
  @Prop({
    required: false,
  })
  slotOffsetMs?: number;

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

UserFeedSchema.index({
  feedRequestLookupKey: 1,
  healthStatus: 1,
});

UserFeedSchema.index({
  url: 1,
  healthStatus: 1,
});

UserFeedSchema.index({
  feedRequestLookupKey: 1,
  disabledCode: 1,
  "connections.discordChannels.disabledCode": 1,
  url: 1,
});

UserFeedSchema.index({
  userRefreshRateSeconds: 1,
  refreshRateSeconds: 1,
});

// For looking up feeds with specific URLs when refreshing user external credentials
UserFeedSchema.index({
  "user.discordUserId": 1,
});

/**
 * Index for slot-based feed scheduling queries.
 * Queries filter by refresh rate, then slot window, then enabled status.
 */
UserFeedSchema.index({
  refreshRateSeconds: 1,
  slotOffsetMs: 1,
  disabledCode: 1,
});

UserFeedSchema.index({
  userRefreshRateSeconds: 1,
  slotOffsetMs: 1,
  disabledCode: 1,
});

export const UserFeedFeature: ModelDefinition = {
  name: UserFeed.name,
  schema: UserFeedSchema,
};

export type UserFeedWithTags = UserFeed & {
  userTags?: {
    _id: Types.ObjectId;
    label: string;
    color: string;
  }[];
};
