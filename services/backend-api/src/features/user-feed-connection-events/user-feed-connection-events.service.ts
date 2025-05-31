import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Types } from "mongoose";
import logger from "../../utils/logger";
import { UserFeed, UserFeedModel } from "../user-feeds/entities";

interface CreatedEvent {
  feedId: string;
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

  async handleCreatedEvents(events: Array<CreatedEvent>) {
    try {
      await this.userFeedModel.bulkWrite(
        // @ts-ignore
        events.map((e) => ({
          updateOne: {
            filter: {
              _id: new Types.ObjectId(e.feedId),
              "shareManageOptions.invites.discordUserId":
                e.creator.discordUserId,
            },
            update: {
              $push: {
                "shareManageOptions.invites.$.connections": {
                  connectionId: e.connectionId,
                },
              },
            },
          },
        }))
      );
    } catch (err) {
      logger.error(`Failed to handle connection created event`, {
        stack: (err as Error).stack,
      });
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
