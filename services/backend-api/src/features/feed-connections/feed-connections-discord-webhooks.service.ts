import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Types } from "mongoose";
import {
  DiscordWebhookInvalidTypeException,
  DiscordWebhookMissingUserPermException,
  DiscordWebhookNonexistentException,
  DiscordWebhookNotOwnedException,
} from "../../common/exceptions";
import { DiscordAuthService } from "../discord-auth/discord-auth.service";
import { DiscordWebhooksService } from "../discord-webhooks/discord-webhooks.service";
import {
  DiscordChannelConnection,
  DiscordWebhookConnection,
} from "../feeds/entities/feed-connections";
import { Feed, FeedModel } from "../feeds/entities/feed.entity";

export interface UpdateDiscordChannelConnectionInput {
  accessToken: string;
  updates: {
    filters?: DiscordChannelConnection["filters"];
    name?: string;
    details?: Partial<DiscordChannelConnection["details"]>;
  };
  guildId: string;
}

@Injectable()
export class FeedConnectionsDiscordWebhooksService {
  constructor(
    @InjectModel(Feed.name) private readonly feedModel: FeedModel,
    private readonly discordWebhooksService: DiscordWebhooksService,
    private readonly discordAuthService: DiscordAuthService
  ) {}

  async createDiscordWebhookConnection({
    accessToken,
    feedId,
    guildId,
    name,
    webhook: { id, name: webhookName, iconUrl },
  }: {
    accessToken: string;
    feedId: string;
    guildId: string;
    name: string;
    webhook: {
      id: string;
      name?: string;
      iconUrl?: string;
    };
  }): Promise<DiscordWebhookConnection> {
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

    if (webhook.guild_id !== guildId) {
      throw new DiscordWebhookNotOwnedException(
        `Discord webhook ${id} is not owned by guild ${guildId}`
      );
    }

    if (
      !(await this.discordAuthService.userManagesGuild(accessToken, guildId))
    ) {
      throw new DiscordWebhookMissingUserPermException(
        `User does not manage guild of webhook webhook ${id}`
      );
    }

    const connectionId = new Types.ObjectId();

    const updated = await this.feedModel.findOneAndUpdate(
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
}
