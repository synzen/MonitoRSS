import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Types } from "mongoose";
import logger from "../../utils/logger";
import { UserFeed, UserFeedModel } from "../user-feeds/entities";
import { UserFeedShareInviteConnection } from "../user-feeds/entities/user-feed-share-manage-options.entity";

interface CreatedEvent {
  feed: UserFeed;
  connectionId: Types.ObjectId;
  creator: {
    discordUserId: string;
  };
}

interface DeletedEvent {
  feed: UserFeed;
  deletedConnectionIds: Types.ObjectId[];
}

@Injectable()
export class UserFeedConnectionEventsService {
  constructor(
    @InjectModel(UserFeed.name) private readonly userFeedModel: UserFeedModel
  ) {}

  async handleCreatedEvent({ feed, connectionId, creator }: CreatedEvent) {
    try {
      const connecionToPush: UserFeedShareInviteConnection = {
        connectionId,
      };

      const matchingInvite = feed.shareManageOptions?.invites.find(
        (invite) => invite.discordUserId === creator.discordUserId
      );

      if (matchingInvite && feed.shareManageOptions?.invites) {
        feed.shareManageOptions.invites = feed.shareManageOptions.invites.map(
          (invite) => {
            if (invite.discordUserId === creator.discordUserId) {
              invite.connections?.push(connecionToPush);
            }

            return invite;
          }
        );

        await this.userFeedModel.updateOne(
          {
            _id: feed._id,
            "shareManageOptions.invites": {
              $elemMatch: {
                discordUserId: creator.discordUserId,
              },
            },
          },
          {
            $set: {
              shareManageOptions: feed.shareManageOptions,
            },
          }
        );
      }
    } catch (err) {
      logger.error(
        `Failed to handle connection created event for feed ${feed._id} and discord user ${creator.discordUserId}`,
        { stack: (err as Error).stack }
      );
    }
  }

  async handleDeletedEvent({ feed, deletedConnectionIds }: DeletedEvent) {
    try {
      const deletedIdStrings = new Set<string>(
        deletedConnectionIds.map((id) => id.toHexString())
      );

      if (feed.shareManageOptions?.invites) {
        feed.shareManageOptions.invites = feed.shareManageOptions.invites.map(
          (invite) => {
            invite.connections = invite.connections?.filter(
              (connection) =>
                !deletedIdStrings.has(connection.connectionId.toHexString())
            );

            return invite;
          }
        );

        await this.userFeedModel.updateOne(
          {
            _id: feed._id,
          },
          {
            $set: {
              shareManageOptions: feed.shareManageOptions,
            },
          }
        );
      }
    } catch (err) {
      logger.error(
        `Failed to handle connection deleted event for feed ${feed._id}`,
        { stack: (err as Error).stack }
      );
    }
  }
}
