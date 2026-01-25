import type { IUserFeedRepository } from "../../repositories/interfaces/user-feed.types";
import type { CreatedEvent, DeletedEvent } from "./types";
import logger from "../../infra/logger";

export interface UserFeedConnectionEventsServiceDeps {
  userFeedRepository: IUserFeedRepository;
}

export class UserFeedConnectionEventsService {
  constructor(private readonly deps: UserFeedConnectionEventsServiceDeps) {}

  async handleCreatedEvents(events: CreatedEvent[]): Promise<void> {
    try {
      await this.deps.userFeedRepository.bulkAddConnectionsToInvites(
        events.map((e) => ({
          feedId: e.feedId,
          connectionId: e.connectionId,
          discordUserId: e.creator.discordUserId,
        }))
      );
    } catch (err) {
      logger.error("Failed to handle connection created event", {
        stack: (err as Error).stack,
      });
    }
  }

  async handleDeletedEvent({
    feedId,
    deletedConnectionIds,
    shareManageOptions,
  }: DeletedEvent): Promise<void> {
    if (!shareManageOptions?.invites) {
      return;
    }

    try {
      await this.deps.userFeedRepository.removeConnectionsFromInvites({
        feedId,
        connectionIds: deletedConnectionIds,
      });
    } catch (err) {
      logger.error(`Failed to handle connection deleted event for feed ${feedId}`, {
        stack: (err as Error).stack,
      });
    }
  }
}
