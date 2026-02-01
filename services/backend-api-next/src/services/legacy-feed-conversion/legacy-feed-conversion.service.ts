import { randomUUID } from "crypto";
import dayjs from "dayjs";
import type { DiscordApiService } from "../discord-api/discord-api.service";
import type { SupportersService } from "../supporters/supporters.service";
import type {
  IFeedRepository,
  IFeed,
} from "../../repositories/interfaces/feed.types";
import type {
  IFeedSubscriberRepository,
  IFeedSubscriber,
} from "../../repositories/interfaces/feed-subscriber.types";
import type {
  IFeedFilteredFormatRepository,
  IFeedFilteredFormat,
} from "../../repositories/interfaces/feed-filtered-format.types";
import type {
  IFailRecordRepository,
  IFailRecord,
} from "../../repositories/interfaces/fail-record.types";
import type {
  IDiscordServerProfileRepository,
  IDiscordServerProfile,
} from "../../repositories/interfaces/discord-server-profile.types";
import type {
  IUserFeedRepository,
  IUserFeed,
  CreateUserFeedInput,
} from "../../repositories/interfaces/user-feed.types";
import type { IUserFeedLimitOverrideRepository } from "../../repositories/interfaces/user-feed-limit-override.types";
import type { IFeedEmbed } from "../../repositories/interfaces/feed-embed.types";
import type {
  IDiscordChannelConnection,
  IFilters,
  ICustomPlaceholder,
} from "../../repositories/interfaces/feed-connection.types";
import {
  FeedConnectionDisabledCode,
  FeedConnectionMentionType,
  CustomPlaceholderStepType,
  UserFeedDisabledCode,
  UserFeedHealthStatus,
} from "../../repositories/shared/enums";
import { AlreadyConvertedToUserFeedException } from "../../shared/exceptions/already-converted-to-user-feed.exception";
import logger from "../../infra/logger";
import { Types } from "mongoose";

export enum ConversionDisabledCode {
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
  MissingPermissionsSendMessageEmbedLinksViewChannel = "Missing permissions SEND_MESSAGES, EMBED_LINKS, VIEW_CHANNEL",
  MissingPermissionsSendMessagesViewChannel = "Missing permissions SEND_MESSAGES, VIEW_CHANNEL",
  MissingPermissionsViewChannel = "Missing permissions VIEW_CHANNEL",
  IncorrectFormat = "There was an issue sending an article due to an incorrectly-formatted text or embed. Update the feed and ensure it works to re-enable",
  DisabledForPersonalRollout = "DISABLED_FOR_PERSONAL_ROLLOUT",
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getConnectionDisabledCode(
  legacyFeedDisabledCode?: string,
): FeedConnectionDisabledCode | undefined {
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
      legacyFeedDisabledCode as LegacyFeedDisabledCode,
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
    `Unknown legacy disabled code while converting legacy feed: ${legacyFeedDisabledCode}`,
  );
}

export interface LegacyFeedConversionServiceDeps {
  discordApiService: DiscordApiService;
  supportersService: SupportersService;
  feedRepository: IFeedRepository;
  feedSubscriberRepository: IFeedSubscriberRepository;
  feedFilteredFormatRepository: IFeedFilteredFormatRepository;
  failRecordRepository: IFailRecordRepository;
  discordServerProfileRepository: IDiscordServerProfileRepository;
  userFeedRepository: IUserFeedRepository;
  userFeedLimitOverrideRepository: IUserFeedLimitOverrideRepository;
}

interface PlaceholderMeta {
  isYoutube: boolean;
  regexPlaceholdersToReplace: Array<{
    regexOpPh: string;
    newPh: string;
  }>;
}

export class LegacyFeedConversionService {
  constructor(private readonly deps: LegacyFeedConversionServiceDeps) {}

  async convertToUserFeed(
    feed: IFeed,
    {
      discordUserId,
      doNotSave,
    }: {
      discordUserId: string;
      doNotSave?: boolean;
    },
  ): Promise<Omit<IUserFeed, "id">> {
    try {
      if (feed.disabled === ConversionDisabledCode.ConvertSuccess) {
        throw new AlreadyConvertedToUserFeedException(
          `Cannot convert feed ${feed.id} to user feed for user` +
            ` ${discordUserId} because it has already been converted`,
        );
      }

      const [{ maxUserFeeds }, currentUserFeedCount] = await Promise.all([
        this.deps.supportersService.getBenefitsOfDiscordUser(discordUserId),
        this.deps.userFeedRepository.countByOwnership(discordUserId),
      ]);

      const addOverrideCount =
        feed.disabled === LegacyFeedDisabledCode.ExceededFeedLimit ? 0 : 1;

      const isOverLimit =
        currentUserFeedCount + addOverrideCount > maxUserFeeds;

      const [profile, subscribers, filteredFormats, failRecord] =
        await Promise.all([
          this.deps.discordServerProfileRepository.findById(feed.guild),
          this.deps.feedSubscriberRepository.findByFeedId(feed.id),
          this.deps.feedFilteredFormatRepository.findByFeedId(feed.id),
          this.deps.failRecordRepository.findByUrl(feed.url),
        ]);

      const converted = await this.getUserFeedEquivalent(feed, {
        discordUserId,
        failRecord,
        profile,
        subscribers,
        filteredFormats,
      });

      if (doNotSave) {
        return converted;
      }

      await this.deps.userFeedRepository.create(
        converted as unknown as CreateUserFeedInput,
      );

      await this.deps.feedRepository.updateById(feed.id, {
        $set: {
          disabled: ConversionDisabledCode.ConvertSuccess,
          disabledReason: "Converted to personal feed",
        },
      });

      if (isOverLimit) {
        await this.deps.userFeedLimitOverrideRepository.upsertIncrement(
          discordUserId,
          1,
        );
      }

      return converted;
    } catch (err) {
      logger.error(
        `Failed to convert feed ${feed.id} to user feed: ${err}`,
        err as Error,
      );

      throw err;
    }
  }

  async getUserFeedEquivalent(
    feed: IFeed,
    {
      discordUserId,
      failRecord,
      filteredFormats,
      profile,
      subscribers,
    }: {
      discordUserId: string;
      profile?: IDiscordServerProfile | null;
      subscribers?: IFeedSubscriber[] | null;
      filteredFormats?: IFeedFilteredFormat[] | null;
      failRecord?: IFailRecord | null;
    },
  ): Promise<Omit<IUserFeed, "id">> {
    const guildId = feed.guild;

    const customPlaceholders: ICustomPlaceholder[] = Object.keys(
      feed.regexOps || {},
    ).flatMap((key) => {
      const regexOp = feed.regexOps?.[key];
      if (!regexOp) return [];

      const allNames = Array.from(new Set(regexOp.map((op) => op.name)));

      const customPlaceholdersOfName: ICustomPlaceholder[] = allNames.map(
        (name) => {
          const nameOps = regexOp.filter((op) => op.name === name);

          return {
            id: `${key}::${name}`,
            referenceName: name,
            sourcePlaceholder: key,
            steps: nameOps.map((op) => ({
              type: CustomPlaceholderStepType.Regex,
              id: randomUUID(),
              regexSearch: op.search.regex,
              replacementString: op.replacementDirect || op.replacement || "",
            })),
          };
        },
      );

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
      await this.deps.supportersService.getBenefitsOfDiscordUser(discordUserId);

    const blockingComparisons = [...(feed.ncomparisons || [])];
    const passingComparisons = [...(feed.pcomparisons || [])];

    if (feed.checkTitles && !blockingComparisons.includes("title")) {
      blockingComparisons.push("title");
    }

    const converted: Omit<IUserFeed, "id"> = {
      legacyFeedId: feed.id,
      connections: {
        discordChannels: [],
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
      blockingComparisons,
      passingComparisons,
      formatOptions: {
        dateFormat: profile?.dateFormat || undefined,
        dateTimezone: profile?.timezone || undefined,
      },
      refreshRateSeconds,
    };

    if (feed.checkDates) {
      converted.dateCheckOptions = {
        oldArticleDateDiffMsThreshold: 1000 * 60 * 60 * 24,
      };
    }

    let name: string;
    let channelToAdd:
      | IDiscordChannelConnection["details"]["channel"]
      | undefined;
    let webhookToAdd:
      | IDiscordChannelConnection["details"]["webhook"]
      | undefined;

    if (!feed.webhook) {
      try {
        const fetched = await this.deps.discordApiService.getChannel(
          feed.channel,
        );
        name = `Channel: #${fetched.name}`;
      } catch {
        name = `Channel: ${feed.channel}`;
      }

      channelToAdd = {
        id: feed.channel,
        guildId,
      };
    } else {
      const webhook = await this.deps.discordApiService.getWebhook(
        feed.webhook.id,
      );
      webhookToAdd = {
        id: feed.webhook.id,
        guildId,
        token: webhook.token as string,
        iconUrl: feed.webhook.avatar,
        name: feed.webhook.name,
      };
      name = `Webhook: ${webhook.name || feed.webhook.id}`;
    }

    const baseConnection: IDiscordChannelConnection = {
      disabledCode: getConnectionDisabledCode(feed.disabled),
      createdAt: feed.createdAt || new Date(),
      updatedAt: feed.updatedAt || new Date(),
      id: randomUUID(),
      name: name,
      splitOptions: {
        isEnabled: feed.split?.enabled || false,
      },
      mentions: {
        targets: subscribers?.map((s) => ({
          id: s.id,
          type: s.type as unknown as FeedConnectionMentionType,
          filters:
            Object.keys(s.rfilters || {}).length > 0
              ? this.convertRegexFilters(s.rfilters)
              : this.convertRegularFilters(s.filters),
        })),
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
          stripImages: !(feed.imgLinksExistence ?? true),
          disableImageLinkPreviews: !(feed.imgPreviews ?? true),
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

    if (filteredFormats?.length) {
      for (const format of filteredFormats) {
        const connectionCopy: IDiscordChannelConnection = {
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

  getHealthStatus(failRecord?: IFailRecord | null): UserFeedHealthStatus {
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
    meta: PlaceholderMeta,
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
        "{extracted::$1::$2$3}",
      );

    meta.regexPlaceholdersToReplace.forEach((regexPlaceholder) => {
      const inputRegex = new RegExp(
        `{${escapeRegExp(regexPlaceholder.regexOpPh)}}`,
        "g",
      );
      replacedWithKnownPlaceholders = replacedWithKnownPlaceholders.replace(
        inputRegex,
        `{${regexPlaceholder.newPh}}`,
      );
    });

    let placeholderRegexResults = placeholderRegex.exec(
      replacedWithKnownPlaceholders,
    );

    while (placeholderRegexResults) {
      const placeholder = placeholderRegexResults[0];

      const convertedFallbackImages = placeholder
        .split("||")
        .map((s) => (s.startsWith("http") ? `text::${s}` : s))
        .join("||");

      replacedWithKnownPlaceholders = replacedWithKnownPlaceholders.replace(
        placeholder,
        convertedFallbackImages,
      );

      placeholderRegexResults = placeholderRegex.exec(
        replacedWithKnownPlaceholders,
      );
    }

    if (meta?.isYoutube) {
      replacedWithKnownPlaceholders = replacedWithKnownPlaceholders.replace(
        /\{description\}/g,
        "{media:group__media:description__#}",
      );
    }

    const rawPlaceholderRegex = /{raw:([^{]+)}/g;

    let rawPlaceholderRegexResults = rawPlaceholderRegex.exec(
      replacedWithKnownPlaceholders,
    );

    while (rawPlaceholderRegexResults) {
      const rawPlaceholder = rawPlaceholderRegexResults[0];

      const replaceWith = this.convertRawPlaceholderField(rawPlaceholder);

      replacedWithKnownPlaceholders = replacedWithKnownPlaceholders.replace(
        rawPlaceholder,
        replaceWith,
      );

      rawPlaceholderRegexResults = rawPlaceholderRegex.exec(
        replacedWithKnownPlaceholders,
      );
    }

    return replacedWithKnownPlaceholders.replace(
      placeholderRegex,
      "{{$1}}",
    ) as T;
  }

  convertRawPlaceholderField(rawPlaceholder: string): string {
    return rawPlaceholder
      .replace("raw:", "")
      .replace(/_/g, "__")
      .replace(/\[(\d+)\]/g, "__$1")
      .replace(/-/g, ":");
  }

  convertEmbeds(
    embeds: IFeedEmbed[] | undefined,
    meta: PlaceholderMeta,
  ): IFeedEmbed[] {
    if (!embeds || embeds.length === 0) {
      return [];
    }

    return embeds.map((embed) => ({
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
      fields: embed.fields?.map((field) => ({
        name: this.convertPlaceholders(field.name, meta) as string,
        value: this.convertPlaceholders(field.value, meta) as string,
        inline: field.inline,
      })),
    }));
  }

  convertRegexFilters(
    filters: Record<string, string> | undefined,
    options?: {
      invert?: boolean;
    },
  ): IFilters | undefined {
    if (!filters || Object.keys(filters).length === 0) {
      return undefined;
    }

    const orExpression: Record<string, unknown> = {
      type: ExpressionType.Logical,
      op: options?.invert
        ? LogicalExpressionOperator.And
        : LogicalExpressionOperator.Or,
      children: [] as Record<string, unknown>[],
    };

    Object.entries(filters).forEach(([category, filterVal]) => {
      const cleanedCategory = category.replace("raw:", "");

      (orExpression.children as Record<string, unknown>[]).push({
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
      orExpression.children = (
        orExpression.children as Record<string, unknown>[]
      ).map((child) => ({
        ...child,
        not: true,
      }));
    }

    return {
      expression: orExpression,
    };
  }

  convertRegularFilters(
    filters: Record<string, string[]> | undefined,
    options?: {
      invert?: boolean;
    },
  ): IFilters | undefined {
    if (!filters || Object.keys(filters).length === 0) {
      return undefined;
    }

    const orExpression: Record<string, unknown> = {
      type: ExpressionType.Logical,
      op: LogicalExpressionOperator.Or,
      children: [] as Record<string, unknown>[],
    };

    const expression: Record<string, unknown> = {
      type: ExpressionType.Logical,
      op: options?.invert
        ? LogicalExpressionOperator.Or
        : LogicalExpressionOperator.And,
      children: [orExpression] as Record<string, unknown>[],
    };

    Object.entries(filters).forEach(([origCategory, filterVals]) => {
      let category = origCategory;

      if (origCategory === "tags") {
        category = "processed::categories";
      }

      for (const rawFilterVal of filterVals) {
        let filterVal = rawFilterVal;

        if (origCategory === "tags" && !filterVal.startsWith("~")) {
          filterVal = `~${filterVal}`;
        }

        const isBroad = filterVal.startsWith("~");
        const isBlocking = filterVal.startsWith("!");
        const isBlockingBroad =
          filterVal.startsWith("!~") || filterVal.startsWith("~!");

        const cleanedCategory = this.convertRawPlaceholderField(category);

        if (isBlockingBroad) {
          (expression.children as Record<string, unknown>[]).push({
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
          (expression.children as Record<string, unknown>[]).push({
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
          (orExpression.children as Record<string, unknown>[]).push({
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
          (orExpression.children as Record<string, unknown>[]).push({
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
      expression.children = (
        expression.children as Record<string, unknown>[]
      ).map((child) => {
        if (
          (child as Record<string, unknown>).type !== ExpressionType.Relational
        ) {
          return child;
        }

        return {
          ...child,
          not: !(child as Record<string, unknown>).not,
        };
      });

      orExpression.children = (
        orExpression.children as Record<string, unknown>[]
      ).map((child) => ({
        ...child,
        not: !(child as Record<string, unknown>).not,
      }));
    }

    return { expression };
  }
}
