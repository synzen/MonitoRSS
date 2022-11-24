import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Types } from "mongoose";
import {
  DiscordWebhookInvalidTypeException,
  DiscordWebhookMissingUserPermException,
  DiscordWebhookNonexistentException,
} from "../../common/exceptions";
import { DiscordAuthService } from "../discord-auth/discord-auth.service";
import { DiscordWebhooksService } from "../discord-webhooks/discord-webhooks.service";
import { DiscordWebhook } from "../discord-webhooks/types/discord-webhook.type";
import { DiscordWebhookConnection } from "../feeds/entities/feed-connections";
import _ from "lodash";
import { UserFeed, UserFeedModel } from "../user-feeds/entities";

export interface UpdateDiscordWebhookConnectionInput {
  accessToken: string;
  feedId: string;
  connectionId: string;
  updates: {
    filters?: DiscordWebhookConnection["filters"] | null;
    name?: string;
    details?: {
      content?: string;
      embeds?: DiscordWebhookConnection["details"]["embeds"];
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
    private readonly discordAuthService: DiscordAuthService
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
    updates: { details, filters, name },
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
      },
      $unset: {
        ...(filters === null && {
          "connections.discordWebhooks.$.filters": "",
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
