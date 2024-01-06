/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { isValidObjectId, Types } from "mongoose";
import { FeedLimitReachedException } from "../feeds/exceptions";
import { SupportersService } from "../supporters/supporters.service";
import { UserFeed, UserFeedModel } from "../user-feeds/entities";
import { UserFeedConnection } from "../user-feeds/types";
import { UserFeedsService } from "../user-feeds/user-feeds.service";
import { UserFeedManagerInviteType, UserFeedManagerStatus } from "./constants";
import {
  UserFeedTransferRequestExiststException,
  UserManagerAlreadyInvitedException,
} from "./exceptions";

@Injectable()
export class UserFeedManagementInvitesService {
  constructor(
    @InjectModel(UserFeed.name) private readonly userFeedModel: UserFeedModel,
    private readonly userFeedsService: UserFeedsService,
    private readonly supportersService: SupportersService
  ) {}

  async createInvite({
    feed,
    targetDiscordUserId,
    type,
    connectionIds,
  }: {
    feed: UserFeed;
    targetDiscordUserId: string;
    type: UserFeedManagerInviteType;
    connectionIds?: string[];
  }) {
    if (!feed.shareManageOptions) {
      feed.shareManageOptions = {
        invites: [],
      };
    }

    if (!feed.shareManageOptions.invites) {
      feed.shareManageOptions.invites = [];
    }

    if (
      feed.shareManageOptions.invites.find(
        (u) => u.discordUserId === targetDiscordUserId
      )
    ) {
      throw new UserManagerAlreadyInvitedException("User already invited");
    }

    if (targetDiscordUserId === feed.user.discordUserId) {
      throw new UserManagerAlreadyInvitedException("Cannot invite self");
    }

    if (
      type === UserFeedManagerInviteType.Transfer &&
      feed.shareManageOptions.invites.find(
        (i) => i.type === UserFeedManagerInviteType.Transfer
      )
    ) {
      throw new UserFeedTransferRequestExiststException(
        "Transfer request already exists"
      );
    }

    const someConnectionIdIsInvalid = connectionIds?.some((id) => {
      const allConnections = Object.values(
        feed.connections
      ).flat() as UserFeedConnection[];

      return (
        !isValidObjectId(id) || !allConnections.find((c) => c.id.equals(id))
      );
    });

    if (someConnectionIdIsInvalid) {
      throw new Error(
        `Some connection IDs are invalid while creating user feed management invite: ${connectionIds}`
      );
    }

    feed.shareManageOptions.invites.push({
      discordUserId: targetDiscordUserId,
      createdAt: new Date(),
      updatedAt: new Date(),
      status: UserFeedManagerStatus.Pending,
      id: new Types.ObjectId(),
      type,
      connectionIds: connectionIds?.map((id) => new Types.ObjectId(id)),
    });

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

  async getUserFeedOfInviteWithOwner(
    inviteId: string,
    ownerDiscordUserId: string
  ) {
    return this.userFeedModel
      .findOne({
        "user.discordUserId": ownerDiscordUserId,
        "shareManageOptions.invites.id": new Types.ObjectId(inviteId),
      })
      .lean();
  }

  async getUserFeedOfInviteWithInvitee(
    inviteId: string,
    inviteeDiscordUserId: string
  ) {
    return this.userFeedModel
      .findOne({
        "shareManageOptions.invites": {
          $elemMatch: {
            id: new Types.ObjectId(inviteId),
            discordUserId: inviteeDiscordUserId,
          },
        },
      })
      .lean();
  }

  async deleteInvite(userFeedId: Types.ObjectId, id: string) {
    await this.userFeedModel.updateOne(
      {
        _id: userFeedId,
      },
      {
        $pull: {
          "shareManageOptions.invites": {
            id: new Types.ObjectId(id),
          },
        },
      }
    );
  }

  async resendInvite(userFeedId: Types.ObjectId, id: string) {
    const found = await this.userFeedModel
      .findOneAndUpdate(
        {
          _id: userFeedId,
          "shareManageOptions.invites.id": new Types.ObjectId(id),
        },
        {
          $set: {
            "shareManageOptions.invites.$.status":
              UserFeedManagerStatus.Pending,
          },
        }
      )
      .select("_id")
      .lean();

    if (!found) {
      throw new NotFoundException(
        `Failed to resend invite ${id} for user feed ${userFeedId}: invite ID is not in user feed`
      );
    }
  }

  async updateInvite(
    userFeed: UserFeed,
    inviteId: string,
    updates: {
      status?: UserFeedManagerStatus;
    }
  ) {
    const inviteIndex = userFeed?.shareManageOptions?.invites?.findIndex(
      (u) => u.id.toHexString() === inviteId
    );

    if (inviteIndex == null || inviteIndex === -1) {
      throw new Error(
        `Failed to update invite ${inviteId} for user feed ${userFeed._id}: invite ID is not in user feed`
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const invite = userFeed.shareManageOptions!.invites[inviteIndex];

    const { maxUserFeeds } =
      await this.supportersService.getBenefitsOfDiscordUser(
        invite.discordUserId
      );

    const currentCount =
      await this.userFeedsService.calculateCurrentFeedCountOfDiscordUser(
        invite.discordUserId
      );

    if (
      updates.status === UserFeedManagerStatus.Accepted &&
      currentCount >= maxUserFeeds
    ) {
      throw new FeedLimitReachedException("Max feeds reached");
    }

    if (!invite.type || invite.type === UserFeedManagerInviteType.CoManage) {
      await this.userFeedModel.updateOne(
        {
          _id: userFeed._id,
        },
        {
          $set: {
            ...(updates.status && {
              [`shareManageOptions.invites.${inviteIndex}.status`]:
                updates.status,
            }),
          },
        }
      );
    } else if (invite.type === UserFeedManagerInviteType.Transfer) {
      await this.userFeedModel.updateOne(
        {
          _id: userFeed._id,
        },
        {
          $set: {
            "user.discordUserId": invite.discordUserId,
            "shareManageOptions.invites": [],
          },
        }
      );
    }
  }

  async getMyPendingInvites(discordUserId: string): Promise<
    Array<{
      id: string;
      feed: Pick<UserFeed, "title" | "url"> & {
        id: string;
        ownerDiscordUserId: string;
      };
    }>
  > {
    const feeds = await this.userFeedModel
      .find({
        "shareManageOptions.invites": {
          $elemMatch: {
            discordUserId,
            status: UserFeedManagerStatus.Pending,
          },
        },
      })
      .select("_id title url user shareManageOptions")
      .lean();

    return feeds.map((feed) => {
      const invite = feed.shareManageOptions!.invites.find(
        (u) => u.discordUserId === discordUserId
      );

      return {
        id: invite!.id.toHexString(),
        type: invite!.type,
        feed: {
          id: feed._id.toHexString(),
          title: feed.title,
          url: feed.url,
          ownerDiscordUserId: feed.user.discordUserId,
        },
      };
    });
  }

  async getMyPendingInviteCount(discordUserId: string): Promise<number> {
    const count = await this.userFeedModel.countDocuments({
      "shareManageOptions.invites": {
        $elemMatch: {
          discordUserId,
          status: UserFeedManagerStatus.Pending,
        },
      },
    });

    return count;
  }
}
