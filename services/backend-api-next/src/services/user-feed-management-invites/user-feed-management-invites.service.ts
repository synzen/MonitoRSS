import { isValidObjectId } from "mongoose";
import type { IUserFeed } from "../../repositories/interfaces/user-feed.types";
import {
  UserFeedManagerInviteType,
  UserFeedManagerStatus,
} from "../../repositories/shared/enums";
import { FeedLimitReachedException } from "../../shared/exceptions/user-feeds.exceptions";
import {
  UserManagerAlreadyInvitedException,
  UserFeedTransferRequestExistsException,
  InviteNotFoundException,
  InvalidConnectionIdException,
} from "../../shared/exceptions/user-feed-management-invites.exceptions";
import type {
  UserFeedManagementInvitesServiceDeps,
  CreateInviteInput,
  UpdateInviteInput,
  PendingInviteResult,
} from "./types";

export class UserFeedManagementInvitesService {
  constructor(private readonly deps: UserFeedManagementInvitesServiceDeps) {}

  async createInvite(input: CreateInviteInput): Promise<void> {
    const { feed, targetDiscordUserId, type, connections } = input;

    const existingInvites = feed.shareManageOptions?.invites ?? [];

    if (existingInvites.find((u) => u.discordUserId === targetDiscordUserId)) {
      throw new UserManagerAlreadyInvitedException("User already invited");
    }

    if (targetDiscordUserId === feed.user.discordUserId) {
      throw new UserManagerAlreadyInvitedException("Cannot invite self");
    }

    if (
      type === UserFeedManagerInviteType.Transfer &&
      existingInvites.find((i) => i.type === UserFeedManagerInviteType.Transfer)
    ) {
      throw new UserFeedTransferRequestExistsException(
        "Transfer request already exists",
      );
    }

    if (connections && connections.length > 0) {
      const allConnections = feed.connections.discordChannels;
      const someConnectionIdIsInvalid = connections.some(
        ({ connectionId: id }) =>
          !isValidObjectId(id) || !allConnections.find((c) => c.id === id),
      );

      if (someConnectionIdIsInvalid) {
        throw new InvalidConnectionIdException(
          `Some connection IDs are invalid while creating user feed management invite: ${connections.map((c) => c.connectionId)}`,
        );
      }
    }

    await this.deps.userFeedRepository.addInviteToFeed(feed.id, {
      discordUserId: targetDiscordUserId,
      type,
      status: UserFeedManagerStatus.Pending,
      connections,
    });
  }

  async getUserFeedOfInviteWithOwner(
    inviteId: string,
    ownerDiscordUserId: string,
  ): Promise<IUserFeed | null> {
    return this.deps.userFeedRepository.findByInviteIdAndOwner(
      inviteId,
      ownerDiscordUserId,
    );
  }

  async getUserFeedOfInviteWithInvitee(
    inviteId: string,
    inviteeDiscordUserId: string,
  ): Promise<IUserFeed | null> {
    return this.deps.userFeedRepository.findByInviteIdAndInvitee(
      inviteId,
      inviteeDiscordUserId,
    );
  }

  async deleteInvite(feedId: string, inviteId: string): Promise<void> {
    await this.deps.userFeedRepository.deleteInviteFromFeed(feedId, inviteId);
  }

  async resendInvite(feedId: string, inviteId: string): Promise<void> {
    const result = await this.deps.userFeedRepository.updateInviteStatus(
      feedId,
      inviteId,
      UserFeedManagerStatus.Pending,
    );

    if (!result) {
      throw new InviteNotFoundException(
        `Failed to resend invite ${inviteId} for user feed ${feedId}: invite ID is not in user feed`,
      );
    }
  }

  async updateInvite(
    userFeed: IUserFeed,
    inviteId: string,
    updates: UpdateInviteInput,
  ): Promise<void> {
    const inviteIndex = userFeed.shareManageOptions?.invites?.findIndex(
      (u) => u.id === inviteId,
    );

    if (inviteIndex == null || inviteIndex === -1) {
      throw new Error(
        `Failed to update invite ${inviteId} for user feed ${userFeed.id}: invite ID is not in user feed`,
      );
    }

    const invite = userFeed.shareManageOptions!.invites[inviteIndex]!;

    const { maxUserFeeds } =
      await this.deps.supportersService.getBenefitsOfDiscordUser(
        invite.discordUserId,
      );

    const currentCount =
      await this.deps.userFeedsService.calculateCurrentFeedCountOfDiscordUser(
        invite.discordUserId,
      );

    if (
      updates.status === UserFeedManagerStatus.Accepted &&
      currentCount >= maxUserFeeds
    ) {
      throw new FeedLimitReachedException("Max feeds reached");
    }

    if (!invite.type || invite.type === UserFeedManagerInviteType.CoManage) {
      await this.deps.userFeedRepository.updateInvite(
        userFeed.id,
        inviteIndex,
        updates,
      );
    } else if (invite.type === UserFeedManagerInviteType.Transfer) {
      await this.deps.userFeedRepository.transferFeedOwnership(
        userFeed.id,
        invite.discordUserId,
      );
    }
  }

  async getMyPendingInvites(
    discordUserId: string,
  ): Promise<PendingInviteResult[]> {
    const feeds =
      await this.deps.userFeedRepository.findFeedsWithPendingInvitesForUser(
        discordUserId,
      );

    return feeds.map((feed) => {
      const invite = feed.shareManageOptions!.invites.find(
        (u) => u.discordUserId === discordUserId,
      )!;

      return {
        id: invite.id,
        type: invite.type,
        feed: {
          id: feed.id,
          title: feed.title,
          url: feed.url,
          ownerDiscordUserId: feed.user.discordUserId,
        },
      };
    });
  }

  async getMyPendingInviteCount(discordUserId: string): Promise<number> {
    return this.deps.userFeedRepository.countPendingInvitesForUser(
      discordUserId,
    );
  }
}
