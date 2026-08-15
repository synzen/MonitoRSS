import type {
  IUserFeedRepository,
  PersonalFeedMoveReceipt,
} from "../../repositories/interfaces/user-feed.types";
import type { FeedCredentialsService } from "../../services/feed-credentials/feed-credentials.service";

export interface PersonalFeedMovesServiceDeps {
  userFeedRepository: IUserFeedRepository;
  feedCredentialsService: FeedCredentialsService;
}

export interface MovePersonalFeedsInput {
  discordUserId: string;
  feedIds: string[];
  workspaceId: string;
  maxWorkspaceFeeds: number;
}

export class PersonalFeedMovesService {
  constructor(private readonly deps: PersonalFeedMovesServiceDeps) {}

  async moveToWorkspace(
    input: MovePersonalFeedsInput,
  ): Promise<PersonalFeedMoveReceipt> {
    const receipt =
      await this.deps.userFeedRepository.movePersonalFeedsToWorkspace(input);

    try {
      await this.deps.feedCredentialsService.syncLookupKeys({
        feedIds: input.feedIds,
      });
    } catch (error) {
      await this.rollback(receipt);
      throw error;
    }

    return receipt;
  }

  async rollback(receipt: PersonalFeedMoveReceipt): Promise<void> {
    await this.deps.userFeedRepository.restorePersonalFeedsFromWorkspace(
      receipt,
    );
    await this.deps.feedCredentialsService.syncLookupKeys({
      feedIds: receipt.feeds.map((feed) => feed.id),
    });
  }
}
