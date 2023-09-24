import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Types } from "mongoose";
import {
  DiscordWebhookInvalidTypeException,
  DiscordWebhookMissingUserPermException,
  DiscordWebhookNonexistentException,
  InsufficientSupporterLevelException,
  InvalidFilterExpressionException,
} from "../../common/exceptions";
import { DiscordAuthService } from "../discord-auth/discord-auth.service";
import { DiscordWebhooksService } from "../discord-webhooks/discord-webhooks.service";
import { DiscordWebhook } from "../discord-webhooks/types/discord-webhook.type";
import { DiscordWebhookConnection } from "../feeds/entities/feed-connections";
import _ from "lodash";
import { UserFeed, UserFeedModel } from "../user-feeds/entities";
import { FeedConnectionDisabledCode } from "../feeds/constants";
import { FeedHandlerService } from "../../services/feed-handler/feed-handler.service";
import {
  SendTestArticleResult,
  SendTestDiscordWebhookArticleInput,
} from "../../services/feed-handler/types";
import {
  castDiscordContentForMedium,
  castDiscordEmbedsForMedium,
} from "../../common/utils";
import { DiscordPreviewEmbed } from "../../common/types/discord-preview-embed.type";
import { DiscordAPIService } from "../../services/apis/discord/discord-api.service";
import {
  CustomPlaceholderDto,
  CustomRateLimitDto,
  DiscordChannelType,
} from "../../common";
import { DiscordWebhookForumChannelUnsupportedException } from "./exceptions";
import { CreateDiscordWebhookConnectionCloneInputDto } from "./dto";
import { SupportersService } from "../supporters/supporters.service";

export interface UpdateDiscordWebhookConnectionInput {
  accessToken: string;
  feedId: string;
  connectionId: string;
  feed: {
    user: {
      discordUserId: string;
    };
  };
  updates: {
    filters?: DiscordWebhookConnection["filters"] | null;
    rateLimits?: CustomRateLimitDto[] | null;
    name?: string;
    customPlaceholders?: CustomPlaceholderDto[] | null;
    disabledCode?: FeedConnectionDisabledCode | null;
    splitOptions?: DiscordWebhookConnection["splitOptions"] | null;
    mentions?: DiscordWebhookConnection["mentions"] | null;
    details?: {
      content?: string;
      embeds?: DiscordWebhookConnection["details"]["embeds"];
      formatter?: DiscordWebhookConnection["details"]["formatter"] | null;
      webhook?: {
        id?: string;
        name?: string;
        iconUrl?: string;
      };
      placeholderLimits:
        | DiscordWebhookConnection["details"]["placeholderLimits"]
        | null;
      enablePlaceholderFallback?: boolean;
    };
  };
}

interface CreatePreviewInput {
  userFeed: UserFeed;
  connection: DiscordWebhookConnection;
  splitOptions?: DiscordWebhookConnection["splitOptions"] | null;
  mentions?: DiscordWebhookConnection["mentions"] | null;
  customPlaceholders?: CustomPlaceholderDto[] | null;
  content?: string;
  embeds?: DiscordPreviewEmbed[];
  feedFormatOptions: UserFeed["formatOptions"] | null;
  connectionFormatOptions?:
    | DiscordWebhookConnection["details"]["formatter"]
    | null;
  placeholderLimits?:
    | DiscordWebhookConnection["details"]["placeholderLimits"]
    | null;
  articleId?: string;
  enablePlaceholderFallback?: boolean;
}

@Injectable()
export class FeedConnectionsDiscordWebhooksService {
  constructor(
    @InjectModel(UserFeed.name) private readonly userFeedModel: UserFeedModel,
    private readonly discordWebhooksService: DiscordWebhooksService,
    private readonly discordAuthService: DiscordAuthService,
    private readonly feedHandlerService: FeedHandlerService,
    private readonly discordApiService: DiscordAPIService,
    private readonly supportersService: SupportersService
  ) {}

  async createDiscordWebhookConnection({
    discordUserId,
    accessToken,
    feedId,
    name,
    webhook: { id, name: webhookName, iconUrl },
  }: {
    discordUserId: string;
    accessToken: string;
    feedId: string;
    name: string;
    webhook: {
      id: string;
      name?: string;
      iconUrl?: string;
    };
  }): Promise<DiscordWebhookConnection> {
    const benefits = await this.supportersService.getBenefitsOfDiscordUser(
      discordUserId
    );

    if (!benefits.isSupporter) {
      throw new Error("User must be a supporter to add webhooks");
    }

    const webhook = await this.assertDiscordWebhookCanBeUsed(id, accessToken);

    const connectionId = new Types.ObjectId();

    const updated = await this.userFeedModel.findOneAndUpdate(
      {
        _id: feedId,
      },
      {
        $push: {
          "connections.discordWebhooks": {
            id: connectionId,
            name,
            details: {
              embeds: [],
              webhook: {
                iconUrl,
                id,
                name: webhookName,
                token: webhook.token,
                guildId: webhook.guild_id,
              },
            },
          },
        },
      },
      {
        new: true,
      }
    );

    const createdConnection = updated?.connections.discordWebhooks.find(
      (connection) => connection.id.equals(connectionId)
    );

    if (!createdConnection) {
      throw new Error(
        "Connection was not successfuly created. Check insertion statement and schemas are correct."
      );
    }

    return createdConnection;
  }

  async cloneConnection(
    userFeed: UserFeed,
    connection: DiscordWebhookConnection,
    discordUserId: string,
    { name }: CreateDiscordWebhookConnectionCloneInputDto
  ) {
    const benefits = await this.supportersService.getBenefitsOfDiscordUser(
      discordUserId
    );

    if (!benefits.isSupporter) {
      throw new InsufficientSupporterLevelException(
        "User must be a supporter to add webhooks"
      );
    }

    const newId = new Types.ObjectId();

    await this.userFeedModel.findOneAndUpdate(
      {
        _id: userFeed._id,
      },
      {
        $push: {
          "connections.discordWebhooks": {
            ...connection,
            id: newId,
            name,
          },
        },
      }
    );

    return {
      id: newId,
    };
  }

  async updateDiscordWebhookConnection({
    feedId,
    connectionId,
    updates: {
      details,
      filters,
      name,
      disabledCode,
      splitOptions,
      mentions,
      customPlaceholders,
      rateLimits,
    },
    accessToken,
    feed: {
      user: { discordUserId },
    },
  }: UpdateDiscordWebhookConnectionInput) {
    const benefits = await this.supportersService.getBenefitsOfDiscordUser(
      discordUserId
    );

    if (!benefits.isSupporter) {
      throw new InsufficientSupporterLevelException(
        "User must be a supporter to modify webhooks"
      );
    }

    if (customPlaceholders?.length && !benefits.allowCustomPlaceholders) {
      throw new InsufficientSupporterLevelException(
        "User must be a supporter of a sufficient tier to use custom placeholders"
      );
    }

    let webhookUpdates:
      | undefined
      | DiscordWebhookConnection["details"]["webhook"] = undefined;

    if (details?.webhook?.id) {
      const webhook = await this.assertDiscordWebhookCanBeUsed(
        details.webhook.id,
        accessToken
      );

      webhookUpdates = _.omitBy(
        {
          id: details.webhook.id,
          name: details.webhook.name,
          iconUrl: details.webhook.iconUrl,
          token: webhook.token as string,
          guildId: webhook.guild_id,
        },
        _.isUndefined
      ) as DiscordWebhookConnection["details"]["webhook"];
    }

    const setRecordDetails: Record<string, unknown> = _.omitBy(
      Object.entries(details || {}).reduce(
        (acc, [key, value]) => ({
          ...acc,
          [`connections.discordWebhooks.$.details.${key}`]: value,
        }),
        {}
      ),
      _.isUndefined
    );

    if (webhookUpdates) {
      setRecordDetails["connections.discordWebhooks.$.details.webhook"] =
        webhookUpdates;
    }

    if (filters) {
      const results = await this.feedHandlerService.validateFilters({
        expression: filters.expression,
      });

      if (results.errors.length) {
        throw new InvalidFilterExpressionException(
          results.errors.map(
            (message) => new InvalidFilterExpressionException(message)
          )
        );
      }
    }

    const findQuery = {
      _id: feedId,
      "connections.discordWebhooks.id": connectionId,
    };

    const updateQuery = {
      $set: {
        ...setRecordDetails,
        ...(filters && {
          "connections.discordWebhooks.$.filters": filters,
        }),
        ...(name && {
          "connections.discordWebhooks.$.name": name,
        }),
        ...(disabledCode && {
          "connections.discordWebhooks.$.disabledCode": disabledCode,
        }),
        ...(splitOptions && {
          "connections.discordWebhooks.$.splitOptions": splitOptions,
        }),
        ...(mentions && {
          "connections.discordWebhooks.$.mentions": mentions,
        }),
        ...(customPlaceholders && {
          "connections.discordWebhooks.$.customPlaceholders":
            customPlaceholders,
        }),
        ...(rateLimits && {
          "connections.discordWebhooks.$.rateLimits": rateLimits,
        }),
      },
      $unset: {
        ...(filters === null && {
          "connections.discordWebhooks.$.filters": "",
        }),
        ...(disabledCode === null && {
          "connections.discordWebhooks.$.disabledCode": "",
        }),
        ...(splitOptions === null && {
          "connections.discordWebhooks.$.splitOptions": "",
        }),
      },
    };

    const updated = await this.userFeedModel.findOneAndUpdate(
      findQuery,
      updateQuery,
      {
        new: true,
      }
    );

    const updatedConnection = updated?.connections.discordWebhooks.find(
      (connection) => connection.id.equals(connectionId)
    );

    if (!updatedConnection) {
      throw new Error(
        "Connection was not successfuly updated. Check insertion statement and schemas are correct."
      );
    }

    return updatedConnection;
  }

  async deleteDiscordWebhookConnection({
    feedId,
    connectionId,
  }: {
    feedId: string;
    connectionId: string;
  }) {
    await this.userFeedModel.updateOne(
      {
        _id: feedId,
      },
      {
        $pull: {
          "connections.discordWebhooks": {
            id: connectionId,
          },
        },
      }
    );
  }

  async sendTestArticle(
    userFeed: UserFeed,
    connection: DiscordWebhookConnection,
    details?: {
      article?: {
        id: string;
      };
      previewInput?: CreatePreviewInput;
    }
  ): Promise<SendTestArticleResult> {
    const previewInput = details?.previewInput;

    let useCustomPlaceholders =
      previewInput?.customPlaceholders || connection.customPlaceholders;

    if (previewInput?.customPlaceholders?.length) {
      const { allowCustomPlaceholders } =
        await this.supportersService.getBenefitsOfDiscordUser(
          userFeed.user.discordUserId
        );

      if (!allowCustomPlaceholders) {
        useCustomPlaceholders = [];
      }
    }

    const cleanedPreviewEmbeds = previewInput?.embeds
      ? previewInput.embeds.map((e) => ({
          title: e.title || undefined,
          description: e.description || undefined,
          url: e.url || undefined,
          imageURL: e.image?.url || undefined,
          thumbnailURL: e.thumbnail?.url || undefined,
          authorIconURL: e.author?.iconUrl || undefined,
          authorName: e.author?.name || undefined,
          authorURL: e.author?.url || undefined,
          color: e.color || undefined,
          footerIconURL: e.footer?.iconUrl || undefined,
          footerText: e.footer?.text || undefined,
          timestamp: e.timestamp || undefined,
          fields:
            e.fields?.filter(
              (f): f is { name: string; value: string; inline?: boolean } =>
                !!f.name && !!f.value
            ) || [],
        }))
      : undefined;

    const payload: SendTestDiscordWebhookArticleInput["details"] = {
      type: "discord",
      feed: {
        url: userFeed.url,
        formatOptions: {
          ...userFeed.formatOptions,
          ...previewInput?.feedFormatOptions,
        },
      },
      article: details?.article ? details.article : undefined,
      mediumDetails: {
        content: castDiscordContentForMedium(
          previewInput?.content || connection.details.content
        ),
        embeds: castDiscordEmbedsForMedium(
          cleanedPreviewEmbeds || connection.details.embeds
        ),
        webhook: {
          id: connection.details.webhook.id,
          name: connection.details.webhook.name,
          iconUrl: connection.details.webhook.iconUrl,
          token: connection.details.webhook.token,
        },
        formatter:
          previewInput?.connectionFormatOptions || connection.details.formatter,
        splitOptions: previewInput?.splitOptions?.isEnabled
          ? previewInput.splitOptions
          : connection.splitOptions?.isEnabled
          ? connection.splitOptions
          : undefined,
        mentions: previewInput?.mentions || connection.mentions,
        customPlaceholders: useCustomPlaceholders,
        placeholderLimits:
          previewInput?.placeholderLimits ||
          connection.details.placeholderLimits,
        enablePlaceholderFallback:
          previewInput?.enablePlaceholderFallback ??
          connection.details.enablePlaceholderFallback,
      },
    } as const;

    return this.feedHandlerService.sendTestArticle({
      details: payload,
    });
  }

  async createPreview({
    connection,
    feedFormatOptions,
    userFeed,
    articleId,
    connectionFormatOptions,
    content,
    embeds,
    splitOptions,
    mentions,
    placeholderLimits,
    enablePlaceholderFallback,
    customPlaceholders,
  }: CreatePreviewInput): Promise<SendTestArticleResult> {
    let useCustomPlaceholders = customPlaceholders || [];

    if (useCustomPlaceholders?.length) {
      const { allowCustomPlaceholders } =
        await this.supportersService.getBenefitsOfDiscordUser(
          userFeed.user.discordUserId
        );

      if (!allowCustomPlaceholders) {
        useCustomPlaceholders = [];
      }
    }

    const payload = {
      type: "discord",
      feed: {
        url: userFeed.url,
        formatOptions: {
          dateFormat: feedFormatOptions?.dateFormat,
          ...feedFormatOptions,
          ...userFeed.formatOptions,
        },
      },
      article: articleId ? { id: articleId } : undefined,
      mediumDetails: {
        content: castDiscordContentForMedium(content),
        embeds: castDiscordEmbedsForMedium(
          embeds?.map((e) => ({
            title: e.title || undefined,
            description: e.description || undefined,
            url: e.url || undefined,
            imageURL: e.image?.url || undefined,
            thumbnailURL: e.thumbnail?.url || undefined,
            authorIconURL: e.author?.iconUrl || undefined,
            authorName: e.author?.name || undefined,
            authorURL: e.author?.url || undefined,
            color: e.color || undefined,
            fields:
              e.fields
                ?.map((f) => ({
                  name: f.name || "",
                  value: f.value || "",
                  inline: f.inline || false,
                }))
                .filter((v) => v.name) || [],
            footerIconURL: e.footer?.iconUrl || undefined,
            footerText: e.footer?.text || undefined,
            timestamp: e.timestamp || undefined,
          }))
        ),
        webhook: {
          id: connection.details.webhook.id,
          name: connection.details.webhook.name,
          iconUrl: connection.details.webhook.iconUrl,
          token: connection.details.webhook.token,
        },
        guildId: connection.details.webhook.guildId,
        formatter: connectionFormatOptions || undefined,
        splitOptions: splitOptions || undefined,
        mentions: mentions || undefined,
        customPlaceholders: useCustomPlaceholders,
        placeholderLimits,
        enablePlaceholderFallback,
      },
    } as const;

    return this.feedHandlerService.createPreview({
      details: payload,
    });
  }

  private async assertDiscordWebhookCanBeUsed(
    id: string,
    accessToken: string
  ): Promise<DiscordWebhook> {
    const webhook = await this.discordWebhooksService.getWebhook(id);

    if (!webhook) {
      throw new DiscordWebhookNonexistentException(
        `Discord webohok ${id} does not exist`
      );
    }

    if (!this.discordWebhooksService.canBeUsedByBot(webhook)) {
      throw new DiscordWebhookInvalidTypeException(
        `Discord webhook ${id} is a different type and is not operable by bot to send messages`
      );
    }

    if (
      !webhook.guild_id ||
      !(await this.discordAuthService.userManagesGuild(
        accessToken,
        webhook.guild_id
      ))
    ) {
      throw new DiscordWebhookMissingUserPermException(
        `User does not manage guild of webhook webhook ${id}`
      );
    }

    const { type } = await this.discordApiService.getChannel(
      webhook.channel_id
    );

    if (type === DiscordChannelType.GUILD_FORUM) {
      throw new DiscordWebhookForumChannelUnsupportedException(
        `Webhook attached to a forum channel is currently unsupported`
      );
    }

    return webhook;
  }
}
