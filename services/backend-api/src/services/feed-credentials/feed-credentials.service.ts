import type { Config } from "../../config";
import {
  UserExternalCredentialStatus,
  UserExternalCredentialType,
} from "../../repositories/shared/enums";
import { RedditConnectionRequiredException } from "../../shared/exceptions/reddit.exceptions";
import type { FeedRequestLookupDetails } from "../../shared/types/feed-request-lookup-details.type";
import {
  getFeedRequestLookupDetails,
  pickFeedCredentialSource,
  type FeedCredentialSource,
} from "../../shared/utils/get-feed-request-lookup-details";
import { isRedditFeedUrl } from "../../shared/utils/is-reddit-feed-url";
import type { WorkspacesService } from "../../features/workspaces/workspaces.service";
import type { UsersService } from "../users/users.service";

export interface FeedCredentialsServiceDeps {
  config: Config;
  usersService: UsersService;
  workspacesService: WorkspacesService;
}

// The request-path chokepoint for per-feed credential resolution. Anything
// that fetches a feed on behalf of a user or workspace gets its lookup
// details and connection gates from here, so no call site can forget the
// workspace-vs-user scope decision.
export class FeedCredentialsService {
  constructor(private readonly deps: FeedCredentialsServiceDeps) {}

  // Fetching counterpart of pickFeedCredentialSource: loads the workspace
  // connection for workspace-scoped feeds (or feeds-to-be), otherwise the
  // already-loaded user is the source. A workspace with no connection
  // resolves to an empty credential list so asserts and lookups fail closed
  // rather than falling back to anyone's personal connection.
  async resolveCredentialSource(
    feed: { workspaceId?: string | null },
    user: FeedCredentialSource,
  ): Promise<FeedCredentialSource> {
    if (!feed.workspaceId) {
      return user;
    }

    const credential = await this.deps.workspacesService.getRedditCredentials(
      feed.workspaceId,
    );

    return pickFeedCredentialSource({
      feed,
      user,
      workspace: { externalCredentials: credential ? [credential] : [] },
    });
  }

  async getLookupDetails({
    feed,
    user,
  }: {
    feed: {
      url: string;
      feedRequestLookupKey?: string;
      workspaceId?: string | null;
    };
    user: FeedCredentialSource;
  }): Promise<FeedRequestLookupDetails | null> {
    return this.getLookupDetailsFromSource({
      feed,
      credentials: await this.resolveCredentialSource(feed, user),
    });
  }

  // For call sites that resolved the source once and reuse it across gates
  // and lookups (e.g. validate-then-revalidate flows).
  getLookupDetailsFromSource({
    feed,
    credentials,
  }: {
    feed: { url: string; feedRequestLookupKey?: string };
    credentials: FeedCredentialSource;
  }): FeedRequestLookupDetails | null {
    return getFeedRequestLookupDetails({
      feed,
      credentials,
      decryptionKey: this.deps.config.BACKEND_API_ENCRYPTION_KEY_HEX,
      redditFeedBaseUrl:
        this.deps.config.BACKEND_API_REDDIT_AUTHENTICATED_FEED_BASE_URL,
    });
  }

  assertRedditConnectionIfRequired(
    url: string,
    credentials: FeedCredentialSource,
  ): void {
    if (!isRedditFeedUrl(url)) {
      return;
    }

    if (!this.deps.config.BACKEND_API_REDDIT_CLIENT_ID) {
      return;
    }

    const hasActiveRedditConnection = credentials.externalCredentials?.some(
      (cred) =>
        cred.type === UserExternalCredentialType.Reddit &&
        cred.status === UserExternalCredentialStatus.Active,
    );

    if (!hasActiveRedditConnection) {
      throw new RedditConnectionRequiredException(
        "Reddit requires a connected account to add Reddit feeds",
      );
    }
  }

  // Reconcile lookup keys for feeds whose scope isn't known at the call site:
  // the user-keyed sync skips workspace feeds and the workspace-keyed sync
  // only matches them, so running both covers either scope exactly once.
  async syncLookupKeys({ feedIds }: { feedIds: string[] }): Promise<void> {
    await Promise.all([
      this.deps.usersService.syncLookupKeys({ feedIds }),
      this.deps.workspacesService.syncWorkspaceLookupKeys({ feedIds }),
    ]);
  }
}
