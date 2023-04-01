import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Types } from "mongoose";
import {
  DiscordWebhookInvalidTypeException,
  DiscordWebhookMissingUserPermException,
  DiscordWebhookNonexistentException,
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
import { SendTestArticleResult } from "../../services/feed-handler/types";
import {
  castDiscordContentForMedium,
  castDiscordEmbedsForMedium,
} from "../../common/utils";

export interface UpdateDiscordWebhookConnectionInput {
  accessToken: string;
  feedId: string;
  connectionId: string;
  updates: {
    filters?: DiscordWebhookConnection["filters"] | null;
    name?: string;
    disabledCode?: FeedConnectionDisabledCode | null;
    splitOptions?: DiscordWebhookConnection["splitOptions"] | null;
    details?: {
      content?: string;
      embeds?: DiscordWebhookConnection["details"]["embeds"];
      formatter?: DiscordWebhookConnection["details"]["formatter"] | null;
      webhook?: {
        id?: string;
        name?: string;
        iconUrl?: string;
      };
    };
  };
}

@Injectable()
export class FeedConnectionsDiscordWebhooksService {
  constructor(
    @InjectModel(UserFeed.name) private readonly userFeedModel: UserFeedModel,
    private readonly discordWebhooksService: DiscordWebhooksService,
    private readonly discordAuthService: DiscordAuthService,
    private readonly feedHandlerService: FeedHandlerService
  ) {}

  async createDiscordWebhookConnection({
    accessToken,
    feedId,
    name,
    webhook: { id, name: webhookName, iconUrl },
  }: {
    accessToken: string;
    feedId: string;
    name: string;
    webhook: {
      id: string;
      name?: string;
      iconUrl?: string;
    };
  }): Promise<DiscordWebhookConnection> {
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

  async updateDiscordWebhookConnection({
    feedId,
    connectionId,
    updates: { details, filters, name, disabledCode, splitOptions },
    accessToken,
  }: UpdateDiscordWebhookConnectionInput) {
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
    }
  ): Promise<SendTestArticleResult> {
    const payload = {
      type: "discord",
      feed: {
        url: userFeed.url,
        formatOptions: {
          dateFormat: userFeed.formatOptions?.dateFormat,
        },
      },
      article: details?.article ? details.article : undefined,
      mediumDetails: {
        content: castDiscordContentForMedium(connection.details.content),
        embeds: castDiscordEmbedsForMedium(connection.details.embeds),
        webhook: {
          id: connection.details.webhook.id,
          name: connection.details.webhook.name,
          iconUrl: connection.details.webhook.iconUrl,
          token: connection.details.webhook.token,
        },
        formatter: connection.details.formatter,
        splitOptions: connection.splitOptions,
      },
    } as const;

    return this.feedHandlerService.sendTestArticle({
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

    return webhook;
  }
}
