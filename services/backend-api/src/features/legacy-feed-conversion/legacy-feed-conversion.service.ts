/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import dayjs from "dayjs";
import { Types } from "mongoose";
import { DiscordAPIService } from "../../services/apis/discord/discord-api.service";
import {
  DiscordServerProfile,
  DiscordServerProfileModel,
} from "../discord-servers/entities";
import { FeedConnectionMentionType } from "../feeds/constants";
import {
  FailRecord,
  FailRecordModel,
} from "../feeds/entities/fail-record.entity";
import { DiscordChannelConnection } from "../feeds/entities/feed-connections";
import {
  FeedFilteredFormat,
  FeedFilteredFormatModel,
} from "../feeds/entities/feed-filtered-format.entity";
import {
  FeedSubscriber,
  FeedSubscriberModel,
} from "../feeds/entities/feed-subscriber.entity";
import { Feed, FeedModel } from "../feeds/entities/feed.entity";
import { SupportersService } from "../supporters/supporters.service";
import { UserFeed, UserFeedModel } from "../user-feeds/entities";
import { UserFeedHealthStatus } from "../user-feeds/types";

enum ExpressionType {
  Relational = "RELATIONAL",
  Logical = "LOGICAL",
}

enum LogicalExpressionOperator {
  And = "AND",
  Or = "OR",
  Not = "NOT",
}

enum RelationalExpressionOperator {
  Eq = "EQ",
  Contains = "CONTAINS",
  Matches = "MATCHES",
  NotEq = "NOT_EQ",
  NotContain = "NOT_CONTAIN",
}

enum RelationalExpressionLeft {
  Article = "ARTICLE",
}

enum RelationalExpressionRight {
  String = "STRING",
  RegExp = "REGEXP",
}

@Injectable()
export class LegacyFeedConversionService {
  constructor(
    @InjectModel(DiscordServerProfile.name)
    private readonly profileModel: DiscordServerProfileModel,
    @InjectModel(Feed.name)
    private readonly feedModel: FeedModel,
    @InjectModel(FeedSubscriber.name)
    private readonly feedSubscriberModel: FeedSubscriberModel,
    @InjectModel(FeedFilteredFormat.name)
    private readonly feedFilteredFormatModel: FeedFilteredFormatModel,
    @InjectModel(FailRecord.name)
    private readonly failRecordModel: FailRecordModel,
    @InjectModel(UserFeed.name)
    private readonly userFeedModel: UserFeedModel,
    private readonly discordApiService: DiscordAPIService,
    private readonly supportersService: SupportersService
  ) {}

  async convertToUserFeeds(
    feeds: Feed[],
    { discordUserId }: { discordUserId: string }
  ) {
    const [profiles, subscribers, filteredFormats, failRecords] =
      await Promise.all([
        this.profileModel.find({
          _id: {
            $in: feeds.map((feed) => feed.guild),
          },
        }),
        this.feedSubscriberModel.find({
          feed: {
            $in: feeds.map((feed) => feed._id),
          },
        }),
        this.feedFilteredFormatModel.find({
          feed: {
            $in: feeds.map((feed) => feed._id),
          },
        }),
        this.failRecordModel.find({
          _id: {
            $in: Array.from(new Set(feeds.map((feed) => feed.url))),
          },
        }),
      ]);

    const profilesByGuild = new Map<string, DiscordServerProfile>();
    profiles.forEach((profile) => {
      profilesByGuild.set(profile._id.toHexString(), profile);
    });

    const subscribersByFeed = new Map<string, FeedSubscriber[]>();
    subscribers.forEach((subscriber) => {
      const feedId = subscriber.feed.toHexString();

      if (!subscribersByFeed.has(feedId)) {
        subscribersByFeed.set(feedId, []);
      }

      subscribersByFeed.get(feedId)?.push(subscriber);
    });

    const filteredFormatsByFeed = new Map<string, FeedFilteredFormat[]>();
    filteredFormats.forEach((filteredFormat) => {
      const feedId = filteredFormat.feed.toHexString();

      if (!filteredFormatsByFeed.has(feedId)) {
        filteredFormatsByFeed.set(feedId, []);
      }

      filteredFormatsByFeed.get(feedId)?.push(filteredFormat);
    });

    const failRecordsByUrl = new Map<string, FailRecord>();
    failRecords.forEach((failRecord) => {
      failRecordsByUrl.set(failRecord._id, failRecord);
    });

    const [{ maxUserFeeds }, currentUserFeedCount] = await Promise.all([
      this.supportersService.getBenefitsOfDiscordUser(discordUserId),
      this.userFeedModel.countDocuments({
        "user.discordUserId": discordUserId,
      }),
    ]);

    const results = await Promise.all(
      feeds.map(async (f, index) => {
        if (currentUserFeedCount + index + 1 > maxUserFeeds) {
          return {
            state: "error",
            error: new Error(
              `Reached the maximum number of user feeds (${maxUserFeeds})`
            ),
          };
        }

        try {
          const converted = await this.getUserFeedEquivalent(f, {
            discordUserId,
            failRecord: failRecordsByUrl.get(f.url),
            profile: profilesByGuild.get(f.guild),
            subscribers: subscribersByFeed.get(f._id.toHexString()),
            filteredFormats: filteredFormatsByFeed.get(f._id.toHexString()),
          });

          return {
            state: "success",
            result: converted,
            feedId: f._id,
          };
        } catch (err) {
          return {
            state: "error",
            error: err as Error,
            feedId: f._id,
          };
        }
      })
    );

    const session = await this.feedModel.startSession();

    await session.withTransaction(async () => {
      const userFeedsToCreate = results
        .filter((r) => r.state === "success")
        .map(({ result }) => result);

      await this.userFeedModel.create(userFeedsToCreate, { session });

      const feedIdsToUpdate = results
        .filter((r) => r.state === "success")
        .map(({ feedId }) => feedId);

      await this.feedModel.updateMany(
        {
          _id: {
            $in: feedIdsToUpdate,
          },
        },
        {
          $set: {
            disabled: "CONVERTED_USER_FEED",
          },
        },
        { session }
      );
    });

    await session.endSession();

    return results;
  }

  // TODO: Fallback images
  async getUserFeedEquivalent(
    feed: Feed,
    {
      discordUserId,
      failRecord,
      filteredFormats,
      profile,
      subscribers,
    }: {
      discordUserId: string;
      profile?: DiscordServerProfile | null;
      subscribers?: FeedSubscriber[] | null;
      filteredFormats?: FeedFilteredFormat[] | null;
      failRecord?: FailRecord | null;
    }
  ) {
    const guildId = feed.guild;
    const convertedFilters = feed.rfilters
      ? this.convertRegexFilters(feed.rfilters)
      : this.convertRegularFilters(feed.filters);
    const convertedEmbeds = this.convertEmbeds(feed.embeds);

    const converted: UserFeed = {
      _id: new Types.ObjectId(),
      legacyFeedId: feed._id,
      connections: {
        discordChannels: [],
        discordWebhooks: [],
      },
      createdAt: feed.createdAt || new Date(),
      updatedAt: feed.updatedAt || new Date(),
      healthStatus: this.getHealthStatus(failRecord),
      title: feed.title,
      url: feed.url,
      user: {
        discordUserId,
      },
      blockingComparisons: feed.ncomparisons,
      passingComparisons: feed.pcomparisons,
      formatOptions: {
        dateFormat: (profile ? profile.dateFormat : undefined) || undefined,
        dateTimezone: (profile ? profile.timezone : undefined) || undefined,
      },
    };

    if (!feed.webhook) {
      converted.connections.discordChannels.push({
        createdAt: feed.createdAt || new Date(),
        updatedAt: feed.updatedAt || new Date(),
        id: new Types.ObjectId(),
        name: feed.title,
        splitOptions: {
          isEnabled: feed.split?.enabled || false,
        },
        mentions: {
          targets: subscribers?.map((s) => ({
            id: s.id,
            type: s.type as unknown as FeedConnectionMentionType,
            filters: s.rfilters
              ? this.convertRegexFilters(s.rfilters)
              : this.convertRegularFilters(s.filters),
          })),
        },
        details: {
          channel: {
            id: feed.channel,
            guildId,
          },
          content: this.convertPlaceholders(feed.text),
          embeds: convertedEmbeds,
          formatter: {
            formatTables: feed.formatTables,
            stripImages: feed.imgLinksExistence,
          },
        },
        filters: convertedFilters,
      });
    } else {
      const webhook = await this.discordApiService.getWebhook(feed.webhook.id);

      converted.connections.discordWebhooks.push({
        createdAt: feed.createdAt || new Date(),
        updatedAt: feed.updatedAt || new Date(),
        id: new Types.ObjectId(),
        name: feed.title,
        splitOptions: {
          isEnabled: feed.split?.enabled || false,
        },
        mentions: {
          targets: subscribers?.map((s) => ({
            id: s.id,
            type: s.type as unknown as FeedConnectionMentionType,
            filters: s.rfilters
              ? this.convertRegexFilters(s.rfilters)
              : this.convertRegularFilters(s.filters),
          })),
        },
        details: {
          webhook: {
            id: feed.webhook.id,
            guildId,
            name: this.convertPlaceholders(feed.webhook.name),
            iconUrl: this.convertPlaceholders(feed.webhook.avatar),
            token: webhook.token,
          },
          content: this.convertPlaceholders(feed.text),
          embeds: convertedEmbeds,
          formatter: {
            formatTables: feed.formatTables,
            stripImages: feed.imgLinksExistence,
          },
        },
        filters: convertedFilters,
      });
    }

    return converted;
  }

  getHealthStatus(failRecord?: FailRecord | null) {
    const feedFailedMoreThanThreeDaysAgo = failRecord?.failedAt
      ? dayjs(failRecord.failedAt).isBefore(dayjs().subtract(3, "day"))
      : false;

    const feedIsCurrentlyFailing = failRecord?.failedAt
      ? dayjs(failRecord.failedAt).isAfter(dayjs().subtract(3, "day"))
      : false;

    if (feedIsCurrentlyFailing) {
      return UserFeedHealthStatus.Failing;
    }

    if (feedFailedMoreThanThreeDaysAgo) {
      return UserFeedHealthStatus.Failed;
    }

    return UserFeedHealthStatus.Ok;
  }

  convertPlaceholders<T extends string | undefined>(text: T): T {
    if (!text) {
      return undefined as T;
    }

    const regex = /\{([^\{\}]*)\}/g;

    return text
      .replace(/\{subscriptions\}/g, "{discord::mentions}")
      .replace(regex, "{{$1}}") as T;
  }

  convertEmbeds(
    embeds: Feed["embeds"]
  ): DiscordChannelConnection["details"]["embeds"] {
    if (!embeds || embeds.length === 0) {
      return [];
    }

    return embeds.map((embed) => {
      return {
        title: this.convertPlaceholders(embed.title),
        authorIconURL: this.convertPlaceholders(embed.authorIconURL),
        authorName: this.convertPlaceholders(embed.authorName),
        authorURL: this.convertPlaceholders(embed.authorURL),
        color: this.convertPlaceholders(embed.color),
        description: this.convertPlaceholders(embed.description),
        footerIconURL: this.convertPlaceholders(embed.footerIconURL),
        footerText: this.convertPlaceholders(embed.footerText),
        imageURL: this.convertPlaceholders(embed.imageURL),
        thumbnailURL: this.convertPlaceholders(embed.thumbnailURL),
        timestamp: this.convertPlaceholders(embed.timestamp),
        url: this.convertPlaceholders(embed.url),
        fields: embed.fields?.map((field) => {
          return {
            name: this.convertPlaceholders(field.name) as string,
            value: this.convertPlaceholders(field.value) as string,
            inline: field.inline,
          };
        }),
      };
    });
  }

  convertRegexFilters(filters: Feed["rfilters"]) {
    if (!filters || Object.keys(filters).length === 0) {
      return;
    }

    const orExpression: Record<string, any> = {
      type: ExpressionType.Logical,
      op: LogicalExpressionOperator.Or,
      children: [],
    };

    Object.entries(filters).forEach(([category, filterVal]) => {
      const cleanedCategory = category.replace("raw:", "");

      orExpression.children.push({
        type: ExpressionType.Relational,
        op: RelationalExpressionOperator.Matches,
        left: {
          type: RelationalExpressionLeft.Article,
          value: cleanedCategory,
        },
        right: {
          type: RelationalExpressionRight.String,
          value: filterVal,
        },
      });
    });

    return {
      expression: orExpression,
    };
  }

  convertRegularFilters(filters: Feed["filters"]) {
    if (!filters || Object.keys(filters).length === 0) {
      return;
    }

    const orExpression: Record<string, any> = {
      type: ExpressionType.Logical,
      op: LogicalExpressionOperator.Or,
      children: [],
    };

    const expression: Record<string, any> = {
      type: ExpressionType.Logical,
      op: LogicalExpressionOperator.And,
      children: [orExpression],
    };

    Object.entries(filters).forEach(([category, filterVals]) => {
      for (let i = 0; i < filterVals.length; ++i) {
        const filterVal = filterVals[i];

        const isBroad = filterVal.startsWith("~");
        const isBlocking = filterVal.startsWith("!");
        const isBlockingBroad =
          filterVal.startsWith("!~") || filterVal.startsWith("~!");

        const cleanedCategory = category.replace("raw:", "");

        if (isBlockingBroad) {
          expression.children.push({
            type: ExpressionType.Relational,
            op: RelationalExpressionOperator.NotContain,
            left: {
              type: RelationalExpressionLeft.Article,
              value: cleanedCategory,
            },
            right: {
              type: RelationalExpressionRight.String,
              value: filterVal.slice(2),
            },
          });
        } else if (isBlocking) {
          expression.children.push({
            type: ExpressionType.Relational,
            op: RelationalExpressionOperator.NotEq,
            left: {
              type: RelationalExpressionLeft.Article,
              value: cleanedCategory,
            },
            right: {
              type: RelationalExpressionRight.String,
              value: filterVal.slice(1),
            },
          });
        } else if (isBroad) {
          orExpression.children.push({
            type: ExpressionType.Relational,
            op: RelationalExpressionOperator.Contains,
            left: {
              type: RelationalExpressionLeft.Article,
              value: cleanedCategory,
            },
            right: {
              type: RelationalExpressionRight.String,
              value: filterVal.slice(1),
            },
          });
        } else {
          orExpression.children.push({
            type: ExpressionType.Relational,
            op: RelationalExpressionOperator.Eq,
            left: {
              type: RelationalExpressionLeft.Article,
              value: cleanedCategory,
            },
            right: {
              type: RelationalExpressionRight.String,
              value: filterVal,
            },
          });
        }
      }
    });

    return { expression };
  }
}
