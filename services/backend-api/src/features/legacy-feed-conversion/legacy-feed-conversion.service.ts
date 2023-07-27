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
import {
  FeedConnectionDisabledCode,
  FeedConnectionMentionType,
} from "../feeds/constants";
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
import {
  UserFeedDisabledCode,
  UserFeedHealthStatus,
} from "../user-feeds/types";

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

enum LegacyFeedDisabledCode {
  ExceededFeedLimit = "Exceeded feed limit",
  ExcessivelyActiveFeed = "Excessively active feed",
  MissingChannel = "Missing channel",
  MissingPermissionsEmbedLinks = "Missing permissions EMBED_LINKS",
  MissingPermissionsEmbedLinksViewChannel = "Missing permissions EMBED_LINKS, VIEW_CHANNEL",
  MissingPermissionsSendMessages = "Missing permissions SEND_MESSAGES",
  MissingPermissionsSendMessagesEmbedLinks = "Missing permissions SEND_MESSAGES, EMBED_LINKS",
  MissingPermissionsSendMessageEmbedLinksViewChannel = "Missing permissions SEND_MESSAGES," +
    " EMBED_LINKS, VIEW_CHANNEL",
  MissingPermissionsSendMessagesViewChannel = "Missing permissions SEND_MESSAGES, VIEW_CHANNEL",
  MissingPermissionsViewChannel = "Missing permissions VIEW_CHANNEL",
  IncorrectFormat = "There was an issue sending an article due to an incorrectly-formatted" +
    " text or embed. Update the feed and ensure it works to re-enable",
}

const getConnectionDisabledCode = (legacyFeedDisabledCode?: string) => {
  if (!legacyFeedDisabledCode) {
    return undefined;
  }

  if (legacyFeedDisabledCode === LegacyFeedDisabledCode.MissingChannel) {
    return FeedConnectionDisabledCode.MissingMedium;
  }

  const setOfMissingPermissions = [
    LegacyFeedDisabledCode.MissingPermissionsEmbedLinks,
    LegacyFeedDisabledCode.MissingPermissionsEmbedLinksViewChannel,
    LegacyFeedDisabledCode.MissingPermissionsSendMessages,
    LegacyFeedDisabledCode.MissingPermissionsSendMessagesEmbedLinks,
    LegacyFeedDisabledCode.MissingPermissionsSendMessageEmbedLinksViewChannel,
    LegacyFeedDisabledCode.MissingPermissionsSendMessagesViewChannel,
    LegacyFeedDisabledCode.MissingPermissionsViewChannel,
  ];

  if (
    setOfMissingPermissions.includes(
      legacyFeedDisabledCode as LegacyFeedDisabledCode
    )
  ) {
    return FeedConnectionDisabledCode.MissingPermissions;
  }

  if (legacyFeedDisabledCode === LegacyFeedDisabledCode.IncorrectFormat) {
    return FeedConnectionDisabledCode.BadFormat;
  }

  const ignore = [
    LegacyFeedDisabledCode.ExceededFeedLimit,
    LegacyFeedDisabledCode.ExcessivelyActiveFeed,
  ];

  if (ignore.includes(legacyFeedDisabledCode as LegacyFeedDisabledCode)) {
    return undefined;
  }

  throw new Error(
    `Unknown legacy disabled code while convertng legacy feed: ${legacyFeedDisabledCode}`
  );
};

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
          const converted: UserFeed = await this.getUserFeedEquivalent(f, {
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

  // TODO: disabled feeds
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
  ): Promise<UserFeed> {
    const guildId = feed.guild;
    const convertedFilters = feed.rfilters
      ? this.convertRegexFilters(feed.rfilters)
      : this.convertRegularFilters(feed.filters);
    const isYoutube = feed.url.toLowerCase().includes("www.youtube.com/feeds");
    const convertedEmbeds = this.convertEmbeds(feed.embeds, {
      isYoutube,
    });

    const healthStatus = this.getHealthStatus(failRecord);

    let disabledCode: UserFeedDisabledCode | undefined;

    if (feed.disabled === LegacyFeedDisabledCode.ExceededFeedLimit) {
      disabledCode = UserFeedDisabledCode.ExceededFeedLimit;
    } else if (feed.disabled === LegacyFeedDisabledCode.ExcessivelyActiveFeed) {
      disabledCode = UserFeedDisabledCode.ExcessivelyActive;
    } else if (healthStatus === UserFeedHealthStatus.Failed) {
      disabledCode = UserFeedDisabledCode.FailedRequests;
    }

    const converted: UserFeed = {
      _id: new Types.ObjectId(),
      legacyFeedId: feed._id,
      connections: {
        discordChannels: [],
        discordWebhooks: [],
      },
      createdAt: feed.createdAt || new Date(),
      updatedAt: feed.updatedAt || new Date(),
      healthStatus,
      disabledCode,
      title: feed.title,
      url: feed.url,
      user: {
        discordUserId,
      },
      blockingComparisons: feed.ncomparisons || [],
      passingComparisons: feed.pcomparisons || [],
      formatOptions: {
        dateFormat: (profile ? profile.dateFormat : undefined) || undefined,
        dateTimezone: (profile ? profile.timezone : undefined) || undefined,
      },
    };

    if (feed.checkTitles && !converted.blockingComparisons?.includes("title")) {
      converted.blockingComparisons?.push("title");
    }

    if (feed.checkDates) {
      converted.dateCheckOptions = {
        oldArticleDateDiffMsThreshold: 1000 * 60 * 60 * 24,
      };
    }

    if (!feed.webhook) {
      converted.connections.discordChannels.push({
        disabledCode: getConnectionDisabledCode(feed.disabled),
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
          content: this.convertPlaceholders(feed.text, {
            isYoutube,
          }),
          embeds: convertedEmbeds,
          formatter: {
            formatTables: feed.formatTables,
            stripImages: !feed.imgLinksExistence,
            disableImageLinkPreviews: !feed.imgPreviews,
          },
          placeholderLimits: [
            {
              characterCount: 790,
              placeholder: "summary",
              appendString: "...",
            },
            {
              characterCount: 790,
              placeholder: "description",
              appendString: "...",
            },
            {
              characterCount: 150,
              placeholder: "title",
              appendString: "...",
            },
          ],
        },
        filters: convertedFilters,
      });
    } else {
      const webhook = await this.discordApiService.getWebhook(feed.webhook.id);

      converted.connections.discordWebhooks.push({
        disabledCode: getConnectionDisabledCode(feed.disabled),
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
            name: this.convertPlaceholders(feed.webhook.name, {
              isYoutube,
            }),
            iconUrl: this.convertPlaceholders(feed.webhook.avatar, {
              isYoutube,
            }),
            token: webhook.token,
          },
          content: this.convertPlaceholders(feed.text, {
            isYoutube,
          }),
          embeds: convertedEmbeds,
          formatter: {
            formatTables: feed.formatTables,
            stripImages: !feed.imgLinksExistence,
            disableImageLinkPreviews: !feed.imgPreviews,
          },
          placeholderLimits: [
            {
              characterCount: 790,
              placeholder: "summary",
              appendString: "...",
            },
            {
              characterCount: 790,
              placeholder: "description",
              appendString: "...",
            },
            {
              characterCount: 150,
              placeholder: "title",
              appendString: "...",
            },
          ],
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

  convertPlaceholders<T extends string | undefined>(
    text: T,
    meta: {
      isYoutube: boolean;
    }
  ): T {
    if (!text) {
      return undefined as T;
    }

    const placeholderRegex = /{([^{}]+(?:||)+[^{}]+)}/g;

    let replacedWithKnownPlaceholders = text
      .replace(/\{subscriptions\}/g, "{discord::mentions}")
      .replace(/\{subscribers\}/g, "{discord::mentions}")
      .replace(/\{date\}/g, "{pubdate}")
      .replace(
        /\{(description|summary|title):(anchor|image)(\d+)\}/g,
        "{extracted::$1::$2$3}"
      );

    let placeholderRegexResults = placeholderRegex.exec(
      replacedWithKnownPlaceholders
    );

    while (placeholderRegexResults) {
      const placeholder = placeholderRegexResults[0];

      const convertedFallbackImages = placeholder
        .split("||")
        .map((s) => (s.startsWith("http") ? `text::${s}` : s))
        .join("||");

      replacedWithKnownPlaceholders = replacedWithKnownPlaceholders.replace(
        placeholder,
        convertedFallbackImages
      );

      placeholderRegexResults = placeholderRegex.exec(
        replacedWithKnownPlaceholders
      );
    }

    if (meta?.isYoutube) {
      replacedWithKnownPlaceholders = replacedWithKnownPlaceholders.replace(
        /\{description\}/g,
        "{media:group__media:description__#}"
      );
    }

    const rawPlaceholderRegex = /{raw:([^{]+)}/g;

    let rawPlaceholderRegexResults = rawPlaceholderRegex.exec(
      replacedWithKnownPlaceholders
    );

    while (rawPlaceholderRegexResults) {
      const rawPlaceholder = rawPlaceholderRegexResults[0];

      const replaceWith = this.convertRawPlaceholderField(rawPlaceholder);

      replacedWithKnownPlaceholders = replacedWithKnownPlaceholders.replace(
        rawPlaceholder,
        replaceWith
      );

      rawPlaceholderRegexResults = rawPlaceholderRegex.exec(
        replacedWithKnownPlaceholders
      );
    }

    return replacedWithKnownPlaceholders.replace(
      placeholderRegex,
      "{{$1}}"
    ) as T;
  }

  convertRawPlaceholderField(rawPlaceholder: string): string {
    return rawPlaceholder
      .replace("raw:", "")
      .replace(/_/g, "__")
      .replace(/\[(\d+)\]/g, `__$1`)
      .replace(/-/g, ":");
  }

  convertEmbeds(
    embeds: Feed["embeds"],
    meta: {
      isYoutube: boolean;
    }
  ): DiscordChannelConnection["details"]["embeds"] {
    if (!embeds || embeds.length === 0) {
      return [];
    }

    return embeds.map((embed) => {
      return {
        title: this.convertPlaceholders(embed.title, meta),
        authorIconURL: this.convertPlaceholders(embed.authorIconURL, meta),
        authorName: this.convertPlaceholders(embed.authorName, meta),
        authorURL: this.convertPlaceholders(embed.authorURL, meta),
        color: this.convertPlaceholders(embed.color, meta),
        description: this.convertPlaceholders(embed.description, meta),
        footerIconURL: this.convertPlaceholders(embed.footerIconURL, meta),
        footerText: this.convertPlaceholders(embed.footerText, meta),
        imageURL: this.convertPlaceholders(embed.imageURL, meta),
        thumbnailURL: this.convertPlaceholders(embed.thumbnailURL, meta),
        timestamp: this.convertPlaceholders(embed.timestamp, meta),
        url: this.convertPlaceholders(embed.url, meta),
        fields: embed.fields?.map((field) => {
          return {
            name: this.convertPlaceholders(field.name, meta) as string,
            value: this.convertPlaceholders(field.value, meta) as string,
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

        const cleanedCategory = this.convertRawPlaceholderField(category);

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
