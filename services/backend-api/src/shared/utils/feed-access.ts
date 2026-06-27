import type { FastifyRequest } from "fastify";
import type { IUserFeed } from "../../repositories/interfaces/user-feed.types";
import type { IUser } from "../../repositories/interfaces/user.types";
import { NotFoundError, ApiErrorCode } from "../../infra/error-handler";
import { isAdminUser } from "./admin";

/**
 * Workspace-feed access helpers.
 *
 * A feed is personal (owned by `user`) XOR workspace-owned (`workspaceId` set).
 * Any member of a feed's workspace may access it and take every action — roles
 * do not restrict feed actions. These helpers centralize the workspace-id
 * resolution and the "does this requester have full management access" check so
 * the ~20 feed and connection handlers stay consistent.
 */

/**
 * The set of workspace ids the requester belongs to, used to authorize
 * workspace-feed access via `findByIdAndOwnership`/`filterFeedIdsByOwnership`.
 * Returns `[]` for a requester who belongs to no workspace.
 */
export async function getRequesterWorkspaceIds(
  request: FastifyRequest,
  user: IUser,
): Promise<string[]> {
  const { workspacesService } = request.container;

  return workspacesService.listWorkspaceIds(user.id);
}

/**
 * Whether the requester has full management access to a feed they already
 * resolved via the ownership filter: the feed creator, an admin, or — for a
 * workspace feed — any member (membership was already proven by the ownership
 * lookup that returned the feed). Personal share-invite co-managers are NOT
 * full-access; their per-connection scoping is handled by the caller.
 */
export function hasFullFeedAccess(
  feed: IUserFeed,
  discordUserId: string,
  isAdmin: boolean,
): boolean {
  return (
    isAdmin || !!feed.workspaceId || feed.user.discordUserId === discordUserId
  );
}

export interface ResolvedFeedRequester {
  feed: IUserFeed;
  user: IUser;
  isAdmin: boolean;
  myWorkspaceIds: string[];
}

/**
 * Resolves the feed a requester is acting on and the access context around it:
 * validates the id, looks up the requesting user, and fetches the feed scoped
 * to what the requester is allowed to see (everything for an admin, else feeds
 * they own, co-manage, or share via workspace membership). Throws 404 when the id is
 * malformed or the feed is not visible to the requester, so callers cannot
 * distinguish "missing" from "not yours". The returned feed is unfiltered;
 * per-connection invite scoping is the caller's responsibility.
 */
export async function resolveFeedForRequester(
  request: FastifyRequest,
  feedId: string,
): Promise<ResolvedFeedRequester> {
  const { userFeedRepository, usersService, config } = request.container;
  const { discordUserId } = request;

  if (!userFeedRepository.areAllValidIds([feedId])) {
    throw new NotFoundError(ApiErrorCode.USER_FEED_NOT_FOUND);
  }

  const user = await usersService.getOrCreateUserByDiscordId(discordUserId);
  const isAdmin = isAdminUser(config, user);
  const myWorkspaceIds = await getRequesterWorkspaceIds(request, user);

  const feed = isAdmin
    ? await userFeedRepository.findById(feedId)
    : await userFeedRepository.findByIdAndOwnership(
        feedId,
        discordUserId,
        myWorkspaceIds,
      );

  if (!feed) {
    throw new NotFoundError(ApiErrorCode.USER_FEED_NOT_FOUND);
  }

  return { feed, user, isAdmin, myWorkspaceIds };
}

/**
 * Whether the requester may act on a specific connection of a feed they already
 * resolved. Full-access requesters (owner, admin, workspace member) may touch every
 * connection. A personal share-invite co-manager is scoped to the connections
 * named on their invite — unless the invite lists none, which grants access to
 * all of them.
 */
export function canAccessConnection(
  feed: IUserFeed,
  discordUserId: string,
  isAdmin: boolean,
  connectionId: string,
): boolean {
  if (hasFullFeedAccess(feed, discordUserId, isAdmin)) {
    return true;
  }

  const invite = feed.shareManageOptions?.invites.find(
    (i) => i.discordUserId === discordUserId,
  );
  const allowedConnectionIds = invite?.connections?.map((c) => c.connectionId);

  return (
    !allowedConnectionIds ||
    allowedConnectionIds.length === 0 ||
    allowedConnectionIds.includes(connectionId)
  );
}
