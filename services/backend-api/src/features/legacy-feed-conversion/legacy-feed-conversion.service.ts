/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import dayjs from "dayjs";
import { Types } from "mongoose";
import { DiscordAPIService } from "../../services/apis/discord/discord-api.service";
import logger from "../../utils/logger";
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
import {
  UserFeedLimitOverride,
  UserFeedLimitOverrideModel,
} from "../supporters/entities/user-feed-limit-overrides.entity";
import { SupportersService } from "../supporters/supporters.service";
import { UserFeed, UserFeedModel } from "../user-feeds/entities";
import {
  UserFeedDisabledCode,
  UserFeedHealthStatus,
} from "../user-feeds/types";
import { LegacyFeedConversionStatus } from "./constants/legacy-feed-conversion-status.constants";
import {
  LegacyFeedConversionJob,
  LegacyFeedConversionJobModel,
} from "./entities/legacy-feed-conversion-job.entity";
import { NoLegacyFeedsToConvertException } from "./exceptions/no-legacy-feeds-to-convert.exception";
import { FeedRegexOp } from "../feeds/entities/feed-regexop.entity";
import { randomUUID } from "crypto";
import { escapeRegExp } from "lodash";
import { HandledByBulkConversionException } from "./exceptions/handled-by-bulk-conversion.exception";
import { AlreadyConvertedToUserFeedException } from "../feeds/exceptions";

enum ConversionDisabledCode {
  ConvertSuccess = "CONVERTED_USER_FEED",
  ConvertPending = "CONVERT_PENDING",
}

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
  DisabledForPersonalRollout = "DISABLED_FOR_PERSONAL_ROLLOUT",
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
    LegacyFeedDisabledCode.DisabledForPersonalRollout,
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
    @InjectModel(UserFeedLimitOverride.name)
    private readonly userFeedLimitOverrideModel: UserFeedLimitOverrideModel,
    @InjectModel(LegacyFeedConversionJob.name)
    private readonly legacyFeedConversionJobModel: LegacyFeedConversionJobModel,
    private readonly discordApiService: DiscordAPIService,
    private readonly supportersService: SupportersService
  ) {}

  async createBulkConversionJob(discordUserId: string, guildId: string) {
    const existingJobCount =
      await this.legacyFeedConversionJobModel.countDocuments({
        guildId,
      });

    const unconvertedFeeds = await this.feedModel
      .find({
        guild: guildId,
        disabled: {
          $nin: [
            ConversionDisabledCode.ConvertSuccess,
            ConversionDisabledCode.ConvertPending,
          ],
        },
      })
      .select("_id")
      .lean();

    if (existingJobCount > 0) {
      const failedCount =
        await this.legacyFeedConversionJobModel.countDocuments({
          discordUserId,
          guildId,
          status: LegacyFeedConversionStatus.Failed,
        });

      if (failedCount > 0) {
        await this.legacyFeedConversionJobModel.updateMany(
          {
            discordUserId,
            guildId,
            status: LegacyFeedConversionStatus.Failed,
          },
          {
            $set: {
              status: LegacyFeedConversionStatus.NotStarted,
            },
            $unset: {
              failReasonPublic: "",
              failReasonInternal: "",
            },
          }
        );

        return {
          total: existingJobCount,
        };
      }
    }

    if (unconvertedFeeds.length === 0) {
      throw new NoLegacyFeedsToConvertException(
        `Cannot create a new conversion job for server ${guildId}, user ${discordUserId}` +
          ` because there are no unconverted feeds`
      );
    }

    const jobsToCreate: LegacyFeedConversionJob[] = unconvertedFeeds.map(
      (f) => ({
        _id: new Types.ObjectId(),
        createdAt: new Date(),
        updatedAt: new Date(),
        guildId,
        discordUserId,
        legacyFeedId: f._id,
        status: LegacyFeedConversionStatus.NotStarted,
      })
    );

    await this.userFeedModel.updateMany(
      {
        _id: {
          $in: unconvertedFeeds.map((f) => f._id),
        },
      },
      {
        $set: {
          disabled: ConversionDisabledCode.ConvertPending,
          disabledReason: "Pending conversion to user feed",
        },
      }
    );
    await this.legacyFeedConversionJobModel.insertMany(jobsToCreate);

    return {
      total: unconvertedFeeds.length,
    };
  }

  async getBulkConversionJobStatus(discordUserId: string, guildId: string) {
    const totalUnconverted = await this.feedModel.countDocuments({
      guild: guildId,
      disabled: {
        $nin: [
          ConversionDisabledCode.ConvertSuccess,
          ConversionDisabledCode.ConvertPending,
        ],
      },
    });
    const [notStarted, inProgress, completed, failed] = await Promise.all([
      this.legacyFeedConversionJobModel.countDocuments({
        discordUserId,
        guildId,
        status: LegacyFeedConversionStatus.NotStarted,
      }),

      this.legacyFeedConversionJobModel.countDocuments({
        discordUserId,
        guildId,
        status: LegacyFeedConversionStatus.InProgress,
      }),

      this.legacyFeedConversionJobModel.countDocuments({
        discordUserId,
        guildId,
        status: LegacyFeedConversionStatus.Completed,
      }),
      this.legacyFeedConversionJobModel.countDocuments({
        discordUserId,
        guildId,
        status: LegacyFeedConversionStatus.Failed,
      }),
    ]);

    let failedJobs: LegacyFeedConversionJob[] = [];
    let failedFeeds: Feed[] = [];

    if (failed > 0) {
      failedJobs = await this.legacyFeedConversionJobModel
        .find({
          discordUserId,
          guildId,
          status: LegacyFeedConversionStatus.Failed,
        })
        .select("_id failReasonPublic legacyFeedId")
        .lean();

      failedFeeds = await this.feedModel
        .find({
          _id: {
            $in: failedJobs.map((j) => j.legacyFeedId),
          },
        })
        .select("_id title url")
        .lean();
    }

    const allJobCounts = notStarted + inProgress + completed + failed;

    const hasStarted = allJobCounts > 0;
    const hasNotStarted = allJobCounts === 0;
    const hasCompleted = notStarted === 0 && inProgress === 0;
    const someUnconverted = totalUnconverted > 0;

    let status = "NOT_STARTED";

    if (hasNotStarted) {
      status = "NOT_STARTED";
    } else if (hasCompleted) {
      if (failed > 0) {
        status = "COMPLETED_WITH_FAILED";
      } else if (someUnconverted) {
        status = "PARTIALLY_COMPLETED"; // some user feeds were restored to legacy feeds
      } else {
        status = "COMPLETED";
      }
    } else if (hasStarted) {
      status = "IN_PROGRESS";
    }

    return {
      status,
      failedFeeds: failedFeeds.map((feed) => ({
        _id: feed._id,
        title: feed.title,
        url: feed.url,
        failReasonPublic: failedJobs.find((j) =>
          j.legacyFeedId.equals(feed._id)
        )?.failReasonPublic,
      })),
      counts: {
        notStarted,
        inProgress,
        completed,
        failed,
      },
    };
  }

  async convertToUserFeed(
    feed: Feed,
    {
      discordUserId,
      isBulkConversion,
      doNotSave,
    }: {
      discordUserId: string;
      isBulkConversion?: boolean;
      doNotSave?: boolean;
    }
  ) {
    try {
      if (feed.disabled === ConversionDisabledCode.ConvertSuccess) {
        throw new AlreadyConvertedToUserFeedException(
          `Cannot convert feed ${feed._id} to user feed for user` +
            ` ${discordUserId} because it is has already been converted`
        );
      }

      const conversionJob =
        await this.legacyFeedConversionJobModel.countDocuments({
          discordUserId,
          guildId: feed.guild,
          legacyFeedId: feed._id,
        });

      if (!isBulkConversion && conversionJob) {
        throw new HandledByBulkConversionException(
          `Cannot convert feed ${feed._id} to user feed for user` +
            ` ${discordUserId} because it is pending a bulk conversion`
        );
      }

      const [{ maxUserFeeds }, currentUserFeedCount] = await Promise.all([
        this.supportersService.getBenefitsOfDiscordUser(discordUserId),
        this.userFeedModel.countDocuments({
          "user.discordUserId": discordUserId,
        }),
      ]);

      const addOverrideCount =
        feed.disabled === LegacyFeedDisabledCode.ExceededFeedLimit ? 0 : 1;

      const isOverLimit =
        currentUserFeedCount + addOverrideCount > maxUserFeeds;

      const [profile, subscribers, filteredFormats, failRecord] =
        await Promise.all([
          this.profileModel.findById(feed.guild).lean(),
          this.feedSubscriberModel
            .find({
              feed: feed._id,
            })
            .lean(),
          this.feedFilteredFormatModel
            .find({
              feed: feed._id,
            })
            .lean(),
          this.failRecordModel.findById(feed.url).lean(),
        ]);

      const converted: UserFeed = await this.getUserFeedEquivalent(feed, {
        discordUserId,
        failRecord,
        profile,
        subscribers: subscribers,
        filteredFormats,
      });

      if (doNotSave) {
        return converted;
      }

      await this.userFeedModel.create([converted]);

      await this.feedModel.updateOne(
        {
          _id: feed._id,
        },
        {
          $set: {
            disabled: ConversionDisabledCode.ConvertSuccess,
            disabledReason: "Converted to personal feed",
          },
        }
      );

      if (isOverLimit) {
        const found = await this.userFeedLimitOverrideModel.findById(
          discordUserId
        );

        if (found) {
          found.additionalUserFeeds = (found.additionalUserFeeds || 0) + 1;

          await found.save();
        } else {
          await this.userFeedLimitOverrideModel.create([
            {
              _id: discordUserId,
              additionalUserFeeds: 1,
            },
          ]);
        }
      }

      return converted;
    } catch (err) {
      logger.error(
        `Failed to convert feed ${feed._id} to user feed: ${err}`,
        err
      );

      throw err;
    }
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

    const customPlaceholders: DiscordChannelConnection["customPlaceholders"] =
      Object.keys(feed.regexOps || {}).flatMap((key) => {
        const regexOp = feed.regexOps?.[key] as FeedRegexOp[];
        const allNames = Array.from(new Set(regexOp.map((op) => op.name)));

        const customPlaceholdersOfName: DiscordChannelConnection["customPlaceholders"] =
          allNames.map((name) => {
            const nameOps = regexOp.filter((op) => op.name === name);

            return {
              id: `${key}::${name}`,
              referenceName: name,
              sourcePlaceholder: key,
              steps: nameOps.map((op) => ({
                id: randomUUID(),
                regexSearch: op.search.regex,
                replacementString: op.replacementDirect || op.replacement || "",
              })),
            };
          });

        return customPlaceholdersOfName;
      });

    const regexPlaceholdersToReplace = customPlaceholders.map((c) => ({
      regexOpPh: `${c.sourcePlaceholder}:${c.referenceName}`,
      newPh: `custom::${c.referenceName}`,
    }));

    const convertedFilters =
      feed.rfilters && Object.keys(feed.rfilters).length > 0
        ? this.convertRegexFilters(feed.rfilters, {
            invert: !!filteredFormats?.length,
          })
        : this.convertRegularFilters(feed.filters, {
            invert: !!filteredFormats?.length,
          });

    const isYoutube = feed.url.toLowerCase().includes("www.youtube.com/feeds");
    const convertedEmbeds = this.convertEmbeds(feed.embeds, {
      isYoutube,
      regexPlaceholdersToReplace,
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

    const { refreshRateSeconds } =
      await this.supportersService.getBenefitsOfDiscordUser(discordUserId);

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
      refreshRateSeconds: refreshRateSeconds,
    };

    if (feed.checkTitles && !converted.blockingComparisons?.includes("title")) {
      converted.blockingComparisons?.push("title");
    }

    if (feed.checkDates) {
      converted.dateCheckOptions = {
        oldArticleDateDiffMsThreshold: 1000 * 60 * 60 * 24,
      };
    }

    let name: string;
    let channelToAdd:
      | DiscordChannelConnection["details"]["channel"]
      | undefined = undefined;
    let webhookToAdd:
      | DiscordChannelConnection["details"]["webhook"]
      | undefined = undefined;

    if (!feed.webhook) {
      try {
        const fetched = await this.discordApiService.getChannel(feed.channel);
        name = `Channel: #${fetched.name}`;
      } catch (err) {
        name = `Channel: ${feed.channel}`;
      }

      channelToAdd = {
        id: feed.channel,
        guildId,
      };
    } else {
      const webhook = await this.discordApiService.getWebhook(feed.webhook.id);
      webhookToAdd = {
        id: feed.webhook.id,
        guildId,
        token: webhook.token as string,
        iconUrl: feed.webhook.avatar,
        name: feed.webhook.name,
      };
      name = `Webhook: ${webhook.name || feed.webhook.id}`;
    }

    const baseConnection: DiscordChannelConnection = {
      disabledCode: getConnectionDisabledCode(feed.disabled),
      createdAt: feed.createdAt || new Date(),
      updatedAt: feed.updatedAt || new Date(),
      id: new Types.ObjectId(),
      name: name,
      splitOptions: {
        isEnabled: feed.split?.enabled || false,
      },
      mentions: {
        targets: subscribers?.map((s) => {
          return {
            id: s.id,
            type: s.type as unknown as FeedConnectionMentionType,
            filters:
              Object.keys(s.rfilters || {}).length > 0
                ? this.convertRegexFilters(s.rfilters)
                : this.convertRegularFilters(s.filters),
          };
        }),
      },
      details: {
        channel: channelToAdd,
        webhook: webhookToAdd,
        content: this.convertPlaceholders(feed.text, {
          isYoutube,
          regexPlaceholdersToReplace,
        }),
        embeds: convertedEmbeds,
        formatter: {
          formatTables: feed.formatTables ?? false,
          stripImages: feed.imgLinksExistence ?? false,
          disableImageLinkPreviews: feed.imgPreviews ?? false,
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
      customPlaceholders,
    };

    converted.connections.discordChannels.push(baseConnection);

    if (!!filteredFormats?.length) {
      for (const format of filteredFormats) {
        const connectionCopy: DiscordChannelConnection = {
          ...baseConnection,
          name: `${name} | Filtered format priority ${format.priority || 0}`,
          details: {
            ...baseConnection.details,
            content: format.text || baseConnection.details.content,
            embeds: format.embeds
              ? this.convertEmbeds(format.embeds, {
                  isYoutube,
                  regexPlaceholdersToReplace,
                })
              : baseConnection.details.embeds,
          },
          filters:
            Object.keys(format.filters || {}).length > 0
              ? this.convertRegularFilters(format.filters)
              : baseConnection.filters,
        };

        converted.connections.discordChannels.push(connectionCopy);
      }
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
      regexPlaceholdersToReplace: Array<{
        regexOpPh: string;
        newPh: string;
      }>;
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

    meta.regexPlaceholdersToReplace.forEach((regexPlaceholder) => {
      const inputRegex = new RegExp(
        `{${escapeRegExp(regexPlaceholder.regexOpPh)}}`,
        "g"
      );
      replacedWithKnownPlaceholders = replacedWithKnownPlaceholders.replace(
        inputRegex,
        `{${regexPlaceholder.newPh}}`
      );
    });

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
      regexPlaceholdersToReplace: Array<{
        regexOpPh: string;
        newPh: string;
      }>;
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
        color: embed.color ? String(embed.color) : undefined,
        description: this.convertPlaceholders(embed.description, meta),
        footerIconURL: this.convertPlaceholders(embed.footerIconURL, meta),
        footerText: this.convertPlaceholders(embed.footerText, meta),
        imageURL: this.convertPlaceholders(embed.imageURL, meta),
        thumbnailURL: this.convertPlaceholders(embed.thumbnailURL, meta),
        timestamp: embed.timestamp,
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

  convertRegexFilters(
    filters: Feed["rfilters"],
    options?: {
      invert?: boolean;
    }
  ) {
    if (!filters || Object.keys(filters).length === 0) {
      return;
    }

    const orExpression: Record<string, any> = {
      type: ExpressionType.Logical,
      op: options?.invert
        ? LogicalExpressionOperator.And
        : LogicalExpressionOperator.Or,
      children: [],
    };

    // !(a | b) = !a & !b

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

    if (options?.invert) {
      orExpression.children = orExpression.children.map(
        (child: Record<string, any>) => ({
          ...child,
          not: true,
        })
      );
    }

    return {
      expression: orExpression,
    };
  }

  convertRegularFilters(
    filters: Feed["filters"],
    options?: {
      invert?: boolean;
    }
  ) {
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
      op: options?.invert
        ? LogicalExpressionOperator.Or
        : LogicalExpressionOperator.And,
      children: [orExpression],
    };

    // !(a & b & c) = !a | !b | !c
    // !(a & b & (c | d)) = !a | !b | !(c & d) = !a | !b | (!c | !d)

    Object.entries(filters).forEach(([origCategory, filterVals]) => {
      let category = origCategory;

      if (origCategory === "tags") {
        category = "processed::categories";
      }

      for (let i = 0; i < filterVals.length; ++i) {
        let filterVal = filterVals[i];

        if (origCategory === "tags" && !filterVal.startsWith("~")) {
          // Old tag filters were separated by newlines, but new ones are separated by commas
          filterVal = `~${filterVal}`;
        }

        const isBroad = filterVal.startsWith("~");
        const isBlocking = filterVal.startsWith("!");
        const isBlockingBroad =
          filterVal.startsWith("!~") || filterVal.startsWith("~!");

        const cleanedCategory = this.convertRawPlaceholderField(category);

        if (isBlockingBroad) {
          expression.children.push({
            type: ExpressionType.Relational,
            op: RelationalExpressionOperator.Contains,
            not: true,
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
            op: RelationalExpressionOperator.Eq,
            not: true,
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

    if (options?.invert) {
      expression.children = expression.children.map(
        (child: Record<string, any>) => {
          if (child.type !== ExpressionType.Relational) {
            return child;
          }

          return {
            ...child,
            not: !child.not,
          };
        }
      );

      orExpression.children = orExpression.children.map(
        (child: Record<string, any>) => {
          return {
            ...child,
            not: !child.not,
          };
        }
      );
    }

    return { expression };
  }
}
