import { HttpStatus, Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Types } from "mongoose";
import { DiscordAPIError } from "../../common/errors/DiscordAPIError";
import logger from "../../utils/logger";
import { FeedConnectionType } from "../feeds/constants";
import { DiscordChannelConnection } from "../feeds/entities/feed-connections";
import { Feed, FeedModel } from "../feeds/entities/feed.entity";
import { FeedsService } from "../feeds/feeds.service";
import {
  DiscordChannelPermissionsException,
  MissingDiscordChannelException,
} from "./exceptions";

@Injectable()
export class FeedConnectionsService {
  constructor(
    private readonly feedsService: FeedsService,
    @InjectModel(Feed.name) private readonly feedModel: FeedModel
  ) {}

  async createDiscordChannelConnection({
    feedId,
    name,
    channelId,
    userAccessToken,
  }: {
    feedId: string;
    name: string;
    channelId: string;
    userAccessToken: string;
  }): Promise<DiscordChannelConnection> {
    try {
      await this.feedsService.canUseChannel({
        channelId,
        userAccessToken,
      });
    } catch (err) {
      logger.info(`Error while getting channel ${channelId} of feed addition`, {
        stack: err.stack,
      });

      if (err instanceof DiscordAPIError) {
        if (err.statusCode === HttpStatus.NOT_FOUND) {
          throw new MissingDiscordChannelException();
        }

        if (err.statusCode === HttpStatus.FORBIDDEN) {
          throw new DiscordChannelPermissionsException();
        }
      }

      throw err;
    }

    const connectionId = new Types.ObjectId();

    const updated = await this.feedModel.findOneAndUpdate(
      {
        _id: feedId,
      },
      {
        $push: {
          "connections.discordChannels": {
            id: connectionId,
            name,
            details: {
              type: FeedConnectionType.DiscordChannel,
              channel: {
                id: channelId,
              },
              embeds: [],
            },
          },
        },
      },
      {
        new: true,
      }
    );

    const createdConnection = updated?.connections.discordChannels.find(
      (connection) => connection.id.equals(connectionId)
    );

    if (!createdConnection) {
      console.log("no created con");
      throw new Error(
        "Connection was not successfuly created. Check insertion statement and schemas are correct."
      );
    }

    return createdConnection;
  }
}
