import { mock } from "node:test";
import { UserFeedConnectionEventsService } from "../../src/services/user-feed-connection-events/user-feed-connection-events.service";
import type { IUserFeedRepository } from "../../src/repositories/interfaces/user-feed.types";
import { generateTestId } from "./test-id";

export interface UserFeedRepositoryMockOptions {
  bulkAddConnectionsToInvites?: () => Promise<void> | Promise<never>;
  removeConnectionsFromInvites?: () => Promise<void> | Promise<never>;
}

export interface UserFeedConnectionEventsContextOptions {
  userFeedRepository?: UserFeedRepositoryMockOptions;
}

export interface MockUserFeedRepository {
  bulkAddConnectionsToInvites: ReturnType<typeof mock.fn>;
  removeConnectionsFromInvites: ReturnType<typeof mock.fn>;
}

export interface UserFeedConnectionEventsContext {
  service: UserFeedConnectionEventsService;
  userFeedRepository: MockUserFeedRepository;
  generateId(): string;
}

export interface UserFeedConnectionEventsHarness {
  createContext(options?: UserFeedConnectionEventsContextOptions): UserFeedConnectionEventsContext;
}

export function createUserFeedConnectionEventsHarness(): UserFeedConnectionEventsHarness {
  return {
    createContext(options: UserFeedConnectionEventsContextOptions = {}): UserFeedConnectionEventsContext {
      const userFeedRepository: MockUserFeedRepository = {
        bulkAddConnectionsToInvites: mock.fn(
          options.userFeedRepository?.bulkAddConnectionsToInvites ?? (() => Promise.resolve())
        ),
        removeConnectionsFromInvites: mock.fn(
          options.userFeedRepository?.removeConnectionsFromInvites ?? (() => Promise.resolve())
        ),
      };

      const service = new UserFeedConnectionEventsService({
        userFeedRepository: userFeedRepository as unknown as IUserFeedRepository,
      });

      return {
        service,
        userFeedRepository,
        generateId: generateTestId,
      };
    },
  };
}
