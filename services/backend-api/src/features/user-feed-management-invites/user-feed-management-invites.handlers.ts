import type { FastifyRequest, FastifyReply } from "fastify";
import { Types } from "mongoose";
import {
  UserFeedManagerInviteType,
  UserFeedManagerStatus,
} from "../../repositories/shared/enums";
import { HttpError } from "../../infra/error-handler";
import { ApiErrorCode } from "../../shared/constants/api-errors";
import type {
  CreateInviteBody,
  UpdateInviteBody,
  UpdateInviteStatusBody,
  InviteIdParams,
} from "./user-feed-management-invites.schemas";

export async function getMyPendingInvitesHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { userFeedManagementInvitesService } = request.container;

  const results = await userFeedManagementInvitesService.getMyPendingInvites(
    request.discordUserId,
  );

  return reply.send({ results });
}

export async function getPendingInviteCountHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { userFeedManagementInvitesService } = request.container;

  const total = await userFeedManagementInvitesService.getMyPendingInviteCount(
    request.discordUserId,
  );

  return reply.send({ total });
}

export async function createInviteHandler(
  request: FastifyRequest<{ Body: CreateInviteBody }>,
  reply: FastifyReply,
): Promise<void> {
  const {
    userFeedManagementInvitesService,
    userFeedRepository,
    usersService,
    config,
  } = request.container;
  const { feedId, discordUserId, type, connections } = request.body;

  const user = await usersService.getOrCreateUserByDiscordId(
    request.discordUserId,
  );
  const isAdmin = config.BACKEND_API_ADMIN_USER_IDS.includes(user.id);

  const feed = isAdmin
    ? await userFeedRepository.findById(feedId)
    : await userFeedRepository.findByIdAndCreator(
        feedId,
        request.discordUserId,
      );

  if (!feed) {
    throw new HttpError(404, ApiErrorCode.USER_FEED_NOT_FOUND);
  }

  const inviteType =
    type === "CO_MANAGE"
      ? UserFeedManagerInviteType.CoManage
      : UserFeedManagerInviteType.Transfer;

  await userFeedManagementInvitesService.createInvite({
    feed,
    targetDiscordUserId: discordUserId,
    type: inviteType,
    connections,
  });

  return reply.send({ result: { status: "SUCCESS" } });
}

export async function resendInviteHandler(
  request: FastifyRequest<{ Params: InviteIdParams }>,
  reply: FastifyReply,
): Promise<void> {
  const { userFeedManagementInvitesService } = request.container;
  const { id: inviteId } = request.params;

  if (!Types.ObjectId.isValid(inviteId)) {
    throw new HttpError(
      404,
      ApiErrorCode.USER_FEED_NOT_FOUND,
      "Invalid Object Id.",
    );
  }

  const feed =
    await userFeedManagementInvitesService.getUserFeedOfInviteWithOwner(
      inviteId,
      request.discordUserId,
    );

  if (!feed) {
    throw new HttpError(
      404,
      ApiErrorCode.USER_FEED_NOT_FOUND,
      `Invite ${inviteId} not found`,
    );
  }

  await userFeedManagementInvitesService.resendInvite(feed.id, inviteId);

  return reply.status(204).send();
}

export async function updateInviteHandler(
  request: FastifyRequest<{ Params: InviteIdParams; Body: UpdateInviteBody }>,
  reply: FastifyReply,
): Promise<void> {
  const { userFeedManagementInvitesService } = request.container;
  const { id: inviteId } = request.params;
  const { connections } = request.body;

  if (!Types.ObjectId.isValid(inviteId)) {
    throw new HttpError(
      404,
      ApiErrorCode.USER_FEED_NOT_FOUND,
      "Invalid Object Id.",
    );
  }

  const feed =
    await userFeedManagementInvitesService.getUserFeedOfInviteWithOwner(
      inviteId,
      request.discordUserId,
    );

  if (!feed) {
    throw new HttpError(
      404,
      ApiErrorCode.USER_FEED_NOT_FOUND,
      `Invite ${inviteId} not found`,
    );
  }

  await userFeedManagementInvitesService.updateInvite(feed, inviteId, {
    connections,
  });

  return reply.send({ result: { status: "SUCCESS" } });
}

export async function updateInviteStatusHandler(
  request: FastifyRequest<{
    Params: InviteIdParams;
    Body: UpdateInviteStatusBody;
  }>,
  reply: FastifyReply,
): Promise<void> {
  const { userFeedManagementInvitesService } = request.container;
  const { id: inviteId } = request.params;
  const { status } = request.body;

  if (!Types.ObjectId.isValid(inviteId)) {
    throw new HttpError(
      404,
      ApiErrorCode.USER_FEED_NOT_FOUND,
      "Invalid Object Id.",
    );
  }

  const feed =
    await userFeedManagementInvitesService.getUserFeedOfInviteWithInvitee(
      inviteId,
      request.discordUserId,
    );

  if (!feed) {
    throw new HttpError(
      404,
      ApiErrorCode.USER_FEED_NOT_FOUND,
      `Invite ${inviteId} not found`,
    );
  }

  const statusEnum =
    status === "ACCEPTED"
      ? UserFeedManagerStatus.Accepted
      : UserFeedManagerStatus.Declined;

  await userFeedManagementInvitesService.updateInvite(feed, inviteId, {
    status: statusEnum,
  });

  return reply.send({ result: { status: "SUCCESS" } });
}

export async function deleteInviteHandler(
  request: FastifyRequest<{ Params: InviteIdParams }>,
  reply: FastifyReply,
): Promise<void> {
  const { userFeedManagementInvitesService } = request.container;
  const { id: inviteId } = request.params;

  if (!Types.ObjectId.isValid(inviteId)) {
    throw new HttpError(
      404,
      ApiErrorCode.USER_FEED_NOT_FOUND,
      "Invalid Object Id.",
    );
  }

  const feed =
    await userFeedManagementInvitesService.getUserFeedOfInviteWithOwner(
      inviteId,
      request.discordUserId,
    );

  if (!feed) {
    throw new HttpError(
      404,
      ApiErrorCode.USER_FEED_NOT_FOUND,
      `Invite ${inviteId} not found`,
    );
  }

  await userFeedManagementInvitesService.deleteInvite(feed.id, inviteId);

  return reply.status(204).send();
}
