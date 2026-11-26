import { randomUUID } from "crypto";
import type { IUserFeed } from "../../repositories/interfaces/user-feed.types";
import type { IUser } from "../../repositories/interfaces/user.types";
import {
  UserExternalCredentialStatus,
  UserExternalCredentialType,
  UserFeedDisabledCode,
  UserFeedHealthStatus,
  UserFeedScheduleMode,
} from "../../repositories/shared/enums";
import { calculateSlotOffsetMs } from "../../shared/utils/fnv1a-hash";
import { isRedditFeedUrl } from "../../shared/utils/is-reddit-feed-url";
import { appliesPremiumRefreshRateFloor } from "../../shared/utils/premium-refresh-rate-floor";
import { resolveRefreshRateLimits } from "./refresh-rate-limits";
import type { FeedCredentialSource } from "../../shared/utils/get-feed-request-lookup-details";
import type { FeedRequestLookupDetails } from "../../shared/types/feed-request-lookup-details.type";
import {
  GetArticlesResponseRequestStatus,
  DeliveryPreviewMediumInput,
  GetArticlesInput,
} from "../feed-handler/types";
import { getEffectiveRefreshRateSeconds } from "../../shared/utils/get-effective-refresh-rate";
import {
  DISABLED_CODES_FOR_EXCEEDED_FEED_LIMITS,
  isBillingEnabled,
  PREMIUM_FEED_ALLOWANCES,
  resolveWorkspacePremiumAllowance,
} from "../../shared/utils/billing";
import {
  BannedFeedException,
  FeedFetchTimeoutException,
  NoFeedOnHtmlPageException,
  FeedParseException,
  FeedRequestException,
  FeedInvalidSslCertException,
  FeedLimitReachedException,
  WorkspaceNotSubscribedException,
  RefreshRateNotAllowedException,
  SourceFeedNotFoundException,
  ManualRequestTooSoonException,
  PremiumFeedsNotSupportedException,
  PremiumFeedsPlanRequiredException,
  PremiumFeedsLimitReachedException,
  RedditConnectionRequiredException,
} from "../../shared/exceptions/user-feeds.exceptions";
import logger from "../../infra/logger";
import type {
  UserFeedsServiceDeps,
  UpdateFeedInput,
  CreateUserFeedInput,
  ValidateFeedUrlOutput,
  CheckUrlIsValidOutput,
  GetFeedArticlePropertiesInput,
  GetFeedArticlePropertiesOutput,
  GetFeedArticlesInput,
  GetFeedArticlesOutput,
  CopyUserFeedSettingsInput,
  PreviewFeedByUrlOutput,
  PreviewFeedByUrlArticle,
} from "./types";
import { UserFeedCopyableSetting } from "./types";
import type {
  CopySettingsTarget,
  CopyableSettings,
  CloneUserFeedInput,
  FeedLimitScope,
  CreateUserFeedInput as CreateUserFeedRepoInput,
  WorkspaceFeedLimitEnforcementQuery,
} from "../../repositories/interfaces/user-feed.types";
import { FeedLimitExceededError } from "../../repositories/interfaces/user-feed.types";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { Types } from "mongoose";
import { FeedFetcherFetchStatus } from "../feed-fetcher-api/types";
import { UserFeedTargetFeedSelectionType } from "../feed-connections-discord-channels/types";
import { MessageBrokerQueue } from "@monitorss/contracts";

dayjs.extend(utc);
dayjs.extend(timezone);

type NextRetryReason = "REFRESH_RATE" | "HOST_CACHE" | "FAILED_RETRY_BACKOFF";

const BULK_DELETE_PUBLISH_CONCURRENCY = 10;

// The only disable states a successful manual request proves recovery from.
// Other codes (Manual, ExceededFeedLimit, ExcessivelyActive, FeedTooLarge)
// are deliberate or limit-driven and have their own re-enable paths.
const MANUALLY_RETRYABLE_DISABLED_CODES = [
  UserFeedDisabledCode.FailedRequests,
  UserFeedDisabledCode.InvalidFeed,
  UserFeedDisabledCode.BadFormat,
];

interface WorkspaceLimitEnforcementOutcome {
  workspaceId: string;
  feedIdsToDisable: string[];
  feedIdsToEnable: string[];
}

export class UserFeedsService {
  constructor(private readonly deps: UserFeedsServiceDeps) {}

  getDatePreview({
    dateFormat,
    dateLocale,
    dateTimezone,
  }: {
    dateFormat?: string;
    dateTimezone?: string;
    dateLocale?: string;
  }) {
    try {
      return {
        output: dayjs()
          .tz(dateTimezone || "UTC")
          .locale(dateLocale || "en")
          .format(dateFormat || undefined),
        valid: true,
      };
    } catch (err) {
      return {
        valid: false,
      };
    }
  }
  private feedLimitScope({
    workspaceId,
    ownerDiscordUserId,
    maxFeeds,
  }: {
    workspaceId: string | null;
    ownerDiscordUserId: string;
    maxFeeds: number;
  }): FeedLimitScope {
    return workspaceId
      ? { scope: "workspace", workspaceId, maxFeeds }
      : { scope: "personal", discordUserId: ownerDiscordUserId, maxFeeds };
  }

  // Platform-ness is feed-requests' classification — access gates and fetch
  // routing share the matcher. Fail-closed: an unreachable feed-requests
  // rejects the operation rather than skipping the gates.
  private async classifyPlatformUrls(urls: string[]): Promise<Set<string>> {
    if (urls.length === 0) {
      return new Set();
    }

    const results = await this.deps.feedFetcherApiService.classifyUrls(urls);
    const platformUrls = new Set<string>();

    urls.forEach((url, i) => {
      if (results[i]) {
        platformUrls.add(url);
      }
    });

    return platformUrls;
  }

  private isMeteredPlatformUrl(
    url: string,
    platformUrls: Set<string>,
    featureFlags?: IUser["featureFlags"],
  ): boolean {
    return (
      !!featureFlags?.premiumFeeds &&
      platformUrls.has(url) &&
      appliesPremiumRefreshRateFloor(url)
    );
  }

  private shouldUsePlatformProvider(
    url: string,
    platformUrls: Set<string>,
    featureFlags?: IUser["featureFlags"],
    isSupporter?: boolean,
  ): boolean {
    return (
      platformUrls.has(url) &&
      (isRedditFeedUrl(url) ||
        (!!isSupporter &&
          this.isMeteredPlatformUrl(url, platformUrls, featureFlags)))
    );
  }

  private meteredPlatformFeedValue(
    url: string,
    platformUrls: Set<string>,
    featureFlags?: IUser["featureFlags"],
  ): true | undefined {
    return this.isMeteredPlatformUrl(url, platformUrls, featureFlags)
      ? true
      : undefined;
  }

  // Feed creation stores the canonical destination form of natural platform
  // URLs (legacy hosts, redundant query params) so identical sources dedupe
  // into one provider fetch. Applied only where raw user input becomes a feed
  // URL — never to stored URLs, which is what keeps existing legacy feeds on
  // the normal fetch path (opt-in migration).
  private async resolveInputUrl(url: string): Promise<string> {
    const [resolved] =
      await this.deps.feedFetcherApiService.resolvePlatformUrls([url]);

    return resolved ?? url;
  }

  // Metered platform feeds sit behind the closed-beta user flag plus a paid
  // plan, with per-scope allowances. Reddit uses the owner's grant and is
  // exempt. Billing disabled (self-host) means uncapped — the gates are
  // billing constructs.
  private async assertPlatformFeedAllowed(input: {
    isMeteredPlatformUrl: boolean;
    user: Pick<IUser, "featureFlags">;
    isSupporter: boolean;
    ownerDiscordUserId: string;
    workspaceId?: string;
    // The scope's total feed limit from the resolved benefits; only read for
    // workspace scope, where it selects the premium allowance rung.
    workspaceFeedLimit: number;
    // The workspace subscription's base product. Tier 2 stays on its fixed
    // premium rung even if a legacy subscription carries add-on feeds.
    workspaceBaseTier?: string | null;
    // Set when re-URLing an existing platform feed: its slot is already
    // counted, so the swap must not count as an additional feed.
    replacesPlatformFeed?: boolean;
  }): Promise<void> {
    if (!input.isMeteredPlatformUrl) {
      return;
    }

    if (!isBillingEnabled(this.deps.config)) {
      return;
    }

    if (!input.user.featureFlags?.premiumFeeds) {
      throw new PremiumFeedsNotSupportedException(
        "Premium feeds are not yet available on this account",
      );
    }

    if (!input.isSupporter) {
      throw new PremiumFeedsPlanRequiredException(
        "Premium feeds require a paid plan",
      );
    }

    const scopedUrls = input.workspaceId
      ? await this.deps.userFeedRepository.findWorkspaceFeedUrls(
          input.workspaceId,
        )
      : await this.deps.userFeedRepository.findPersonalFeedUrlsByOwner(
          input.ownerDiscordUserId,
        );

    const scopedFeedUrls = scopedUrls.map((feed) => feed.url);
    const scopedPlatformUrls = await this.classifyPlatformUrls(scopedFeedUrls);

    // Counted per feed, not per distinct URL — the allowance is feed slots.
    const used =
      scopedFeedUrls.filter((url) => {
        return (
          scopedPlatformUrls.has(url) && appliesPremiumRefreshRateFloor(url)
        );
      }).length - (input.replacesPlatformFeed ? 1 : 0);
    const allowance = input.workspaceId
      ? resolveWorkspacePremiumAllowance({
          totalFeeds: input.workspaceFeedLimit,
          baseTier: input.workspaceBaseTier,
        })
      : PREMIUM_FEED_ALLOWANCES.personal;

    if (used >= allowance) {
      throw new PremiumFeedsLimitReachedException(
        `Premium feed limit reached (${allowance} allowed in this scope)`,
      );
    }
  }

  // The provider-cost floor: a metered platform feed must never fetch faster
  // than the configured minimum, on any path that writes a refresh rate.
  private clampMeteredPlatformRefreshRateSeconds(
    url: string,
    isPlatformUrl: boolean,
    rateSeconds: number,
    featureFlags?: IUser["featureFlags"],
  ): number {
    if (
      !this.isMeteredPlatformUrl(
        url,
        isPlatformUrl ? new Set([url]) : new Set(),
        featureFlags,
      )
    ) {
      return rateSeconds;
    }

    return Math.max(
      rateSeconds,
      this.deps.config.BACKEND_API_PREMIUM_FEEDS_MIN_REFRESH_RATE_SECONDS,
    );
  }

  // Reddit fetches through the feed owner's own OAuth grant (the official
  // API serves nothing anonymously), so a reddit feed without a usable grant
  // in its scope is rejected at the write paths instead of idling.
  private assertRedditCredential(credentials: FeedCredentialSource): void {
    const hasUsableGrant = credentials.externalCredentials?.some(
      (cred) =>
        cred.type === UserExternalCredentialType.Reddit &&
        cred.status !== UserExternalCredentialStatus.Revoked &&
        !!cred.data?.accessToken,
    );

    if (!hasUsableGrant) {
      throw new RedditConnectionRequiredException();
    }
  }

  // Translates the repository's limit sentinel into the exception callers handle.
  private async createWithFeedLimit(
    input: CreateUserFeedRepoInput,
    scope: FeedLimitScope,
  ): Promise<IUserFeed> {
    try {
      return await this.deps.userFeedRepository.createWithLimitEnforcement(
        input,
        scope,
      );
    } catch (err) {
      if (err instanceof FeedLimitExceededError) {
        throw new FeedLimitReachedException("Max feeds reached");
      }

      throw err;
    }
  }

  private async cloneWithFeedLimit(
    input: CloneUserFeedInput,
    scope: FeedLimitScope,
  ): Promise<IUserFeed> {
    try {
      return await this.deps.userFeedRepository.cloneWithLimitEnforcement(
        input,
        scope,
      );
    } catch (err) {
      if (err instanceof FeedLimitExceededError) {
        throw new FeedLimitReachedException("Max feeds reached");
      }

      throw err;
    }
  }

  async addFeed(
    {
      discordUserId,
      userAccessToken,
    }: { discordUserId: string; userAccessToken: string },
    { title, url, sourceFeedId, workspaceId }: CreateUserFeedInput,
  ): Promise<IUserFeed> {
    const user =
      await this.deps.usersService.getOrCreateUserByDiscordId(discordUserId);
    const userId = user.id;

    // Workspace feeds draw their limits from workspace benefits (hardcoded today, a
    // future workspace Paddle subscription later) — never the creator's personal
    // supporter perks. Membership is verified before creation.
    if (workspaceId) {
      await this.deps.workspacesService.getWorkspaceForMember(
        workspaceId,
        userId,
      );
    }

    const myWorkspaceIds = workspaceId ? [workspaceId] : [];

    const [feedBenefits, sourceFeedToCopyFrom] = await Promise.all([
      this.deps.supportersService.resolveFeedBenefits({
        workspaceId,
        user: { discordUserId },
      }),
      sourceFeedId
        ? this.deps.userFeedRepository.findByIdAndOwnership(
            sourceFeedId,
            discordUserId,
            myWorkspaceIds,
          )
        : null,
    ]);

    const { maxFeeds, maxDailyArticles, refreshRateSeconds, dormant } =
      feedBenefits;

    // The dormant gate fires before any URL validation so the rejection is
    // unmistakable (activation prompt) rather than a generic fetch failure.
    if (workspaceId && dormant) {
      throw new WorkspaceNotSubscribedException(
        `Workspace ${workspaceId} has no active subscription`,
      );
    }

    if (sourceFeedId && !sourceFeedToCopyFrom) {
      throw new SourceFeedNotFoundException(
        `Feed with ID ${sourceFeedId} not found for user ${discordUserId}`,
      );
    }

    const [credentialSource, resolvedUrl] = await Promise.all([
      this.deps.feedCredentialsService.resolveCredentialSource(
        { workspaceId },
        user,
      ),
      this.resolveInputUrl(url),
    ]);

    const tempLookupDetails =
      this.deps.feedCredentialsService.getLookupDetailsFromSource({
        feed: { url: resolvedUrl, feedRequestLookupKey: randomUUID() },
        credentials: credentialSource,
      });

    const inputPlatformUrls = await this.classifyPlatformUrls([resolvedUrl]);
    const usePlatformProvider = this.shouldUsePlatformProvider(
      resolvedUrl,
      inputPlatformUrls,
      user.featureFlags,
      feedBenefits.isSupporter,
    );

    if (
      user.featureFlags?.premiumFeeds &&
      this.isMeteredPlatformUrl(
        resolvedUrl,
        inputPlatformUrls,
        user.featureFlags,
      )
    ) {
      await this.assertPlatformFeedAllowed({
        isMeteredPlatformUrl: true,
        user,
        isSupporter: feedBenefits.isSupporter,
        ownerDiscordUserId: discordUserId,
        workspaceId,
        workspaceFeedLimit: maxFeeds,
        workspaceBaseTier: feedBenefits.premiumFeedBaseTier,
      });
    }

    const { finalUrl, enableDateChecks, feedTitle } =
      await this.checkUrlIsValid(
        resolvedUrl,
        tempLookupDetails,
        usePlatformProvider,
      );

    // Gated on the validated final URL so a redirect landing on a platform
    // host cannot bypass the gate (same as the clone/update paths).
    const platformUrls = await this.classifyPlatformUrls([finalUrl]);
    const isPlatformUrl = platformUrls.has(finalUrl);

    await this.assertPlatformFeedAllowed({
      isMeteredPlatformUrl: this.isMeteredPlatformUrl(
        finalUrl,
        platformUrls,
        user.featureFlags,
      ),
      user,
      isSupporter: feedBenefits.isSupporter,
      ownerDiscordUserId: discordUserId,
      workspaceId,
      workspaceFeedLimit: maxFeeds,
      workspaceBaseTier: feedBenefits.premiumFeedBaseTier,
    });

    if (isRedditFeedUrl(finalUrl)) {
      this.assertRedditCredential(credentialSource);
    }

    const effectiveRefreshRateSeconds =
      this.clampMeteredPlatformRefreshRateSeconds(
        finalUrl,
        isPlatformUrl,
        refreshRateSeconds,
        user.featureFlags,
      );

    const {
      connections,
      workspaceId: _sourceWorkspaceId,
      ...propertiesToCopy
    } = sourceFeedToCopyFrom || {};

    const created = await this.createWithFeedLimit(
      {
        ...propertiesToCopy,
        title: title || feedTitle || "Untitled Feed",
        url: finalUrl,
        inputUrl: url,
        user: {
          id: userId,
          discordUserId,
        },
        workspaceId,
        refreshRateSeconds: effectiveRefreshRateSeconds,
        isMeteredPlatformFeed: this.meteredPlatformFeedValue(
          finalUrl,
          platformUrls,
          user.featureFlags,
        ),
        slotOffsetMs: calculateSlotOffsetMs(
          finalUrl,
          effectiveRefreshRateSeconds,
        ),
        maxDailyArticles,
        // Reddit feeds ride the per-feed credentialed lookup path (their
        // fetches carry the owner's grant); other platform feeds fetch
        // keyless on the plain URL so shared sources batch.
        feedRequestLookupKey: isRedditFeedUrl(finalUrl)
          ? tempLookupDetails?.key
          : isPlatformUrl
            ? undefined
            : tempLookupDetails?.key,
        dateCheckOptions: enableDateChecks
          ? { oldArticleDateDiffMsThreshold: 1000 * 60 * 60 * 24 }
          : undefined,
      },
      this.feedLimitScope({
        workspaceId: workspaceId ?? null,
        ownerDiscordUserId: discordUserId,
        maxFeeds,
      }),
    );

    if (workspaceId) {
      // The workspace can be deleted while URL validation above is in flight;
      // an insert landing after deletion's feed sweep would survive as an
      // orphan no scope can reach. Re-verify and undo the insert if so.
      try {
        await this.deps.workspacesService.getWorkspaceForMember(
          workspaceId,
          userId,
        );
      } catch (err) {
        await this.bulkDelete([created.id]);

        throw err;
      }
    }

    if (connections) {
      for (const c of connections.discordChannels) {
        await this.deps.feedConnectionsDiscordChannelsService.cloneConnection(
          c,
          {
            targetFeedSelectionType: UserFeedTargetFeedSelectionType.Selected,
            name: c.name,
            targetFeedIds: [created.id],
          },
          userAccessToken,
          discordUserId,
        );
      }
    }

    return created;
  }

  async clone(
    feedId: string,
    userAccessToken: string,
    data?: {
      title?: string;
      url?: string;
      // `undefined` retains the legacy source scope; `null` explicitly targets
      // personal feeds.
      workspaceId?: string | null;
    },
    existingUser?: IUser,
  ) {
    const sourceFeed = await this.deps.userFeedRepository.findById(feedId);

    if (!sourceFeed) {
      throw new Error(`Feed ${feedId} not found while cloning`);
    }

    const destinationWorkspaceId =
      data?.workspaceId === undefined
        ? sourceFeed.workspaceId
        : (data.workspaceId ?? undefined);
    const user =
      existingUser ??
      (await this.deps.usersService.getOrCreateUserByDiscordId(
        sourceFeed.user.discordUserId,
      ));

    if (destinationWorkspaceId) {
      await this.deps.workspacesService.getWorkspaceForMember(
        destinationWorkspaceId,
        user.id,
      );
    }

    const {
      maxFeeds,
      dormant,
      isSupporter,
      premiumFeedBaseTier: destinationPremiumFeedBaseTier,
    } = await this.deps.supportersService.resolveFeedBenefits({
      workspaceId: destinationWorkspaceId,
      user: { discordUserId: sourceFeed.user.discordUserId },
    });

    if (destinationWorkspaceId && dormant) {
      throw new WorkspaceNotSubscribedException(
        `Workspace ${destinationWorkspaceId} has no active subscription`,
      );
    }

    const credentialSource =
      await this.deps.feedCredentialsService.resolveCredentialSource(
        { workspaceId: destinationWorkspaceId },
        user,
      );

    let inputUrl = sourceFeed.inputUrl;
    let finalUrl = sourceFeed.url;

    // Null when the clone keeps the source feed's url — no validation fetch.
    const cloneUrl = data?.url && data.url !== sourceFeed.url ? data.url : null;

    if (cloneUrl) {
      const resolvedCloneUrl = await this.resolveInputUrl(cloneUrl);
      const inputPlatformUrls = await this.classifyPlatformUrls([
        resolvedCloneUrl,
      ]);

      if (
        user.featureFlags?.premiumFeeds &&
        this.isMeteredPlatformUrl(
          resolvedCloneUrl,
          inputPlatformUrls,
          user.featureFlags,
        )
      ) {
        await this.assertPlatformFeedAllowed({
          isMeteredPlatformUrl: true,
          user,
          isSupporter,
          ownerDiscordUserId: sourceFeed.user.discordUserId,
          workspaceId: destinationWorkspaceId,
          workspaceFeedLimit: maxFeeds,
          workspaceBaseTier: destinationPremiumFeedBaseTier,
        });
      }

      finalUrl = (
        await this.checkUrlIsValid(
          resolvedCloneUrl,
          this.deps.feedCredentialsService.getLookupDetailsFromSource({
            feed: sourceFeed,
            credentials: credentialSource,
          }),
          this.shouldUsePlatformProvider(
            resolvedCloneUrl,
            inputPlatformUrls,
            user.featureFlags,
            isSupporter,
          ),
        )
      ).finalUrl;

      inputUrl = cloneUrl;
    }

    const platformUrls = await this.classifyPlatformUrls([finalUrl]);
    const isPlatformUrl = platformUrls.has(finalUrl);

    await this.assertPlatformFeedAllowed({
      isMeteredPlatformUrl: this.isMeteredPlatformUrl(
        finalUrl,
        platformUrls,
        user.featureFlags,
      ),
      user,
      isSupporter,
      ownerDiscordUserId: sourceFeed.user.discordUserId,
      workspaceId: destinationWorkspaceId,
      workspaceFeedLimit: maxFeeds,
      workspaceBaseTier: destinationPremiumFeedBaseTier,
    });

    if (isRedditFeedUrl(finalUrl)) {
      this.assertRedditCredential(credentialSource);
    }

    // A premium clone inherits the source's rates; a user rate below the floor
    // is dropped (falls back to the floored base rate) rather than copied.
    // Reddit clones keep their rates: the floor does not apply to them.
    const meteredRateOverrides: {
      refreshRateSeconds?: number;
      userRefreshRateSeconds?: number | null;
    } = {};

    if (this.isMeteredPlatformUrl(finalUrl, platformUrls, user.featureFlags)) {
      meteredRateOverrides.refreshRateSeconds =
        this.clampMeteredPlatformRefreshRateSeconds(
          finalUrl,
          isPlatformUrl,
          sourceFeed.refreshRateSeconds ??
            this.deps.supportersService.defaultRefreshRateSeconds,
          user.featureFlags,
        );

      if (
        sourceFeed.userRefreshRateSeconds &&
        sourceFeed.userRefreshRateSeconds <
          this.deps.config.BACKEND_API_PREMIUM_FEEDS_MIN_REFRESH_RATE_SECONDS
      ) {
        meteredRateOverrides.userRefreshRateSeconds = null;
      }
    }

    const created = await this.cloneWithFeedLimit(
      {
        sourceFeed,
        overrides: {
          title: data?.title,
          url: finalUrl,
          inputUrl,
          workspaceId: destinationWorkspaceId,
          // Clones never inherit the source's request-row key (the repo
          // strips it); reddit destinations mint a fresh one so their
          // fetches ride the credentialed lookup path.
          ...(isRedditFeedUrl(finalUrl)
            ? { feedRequestLookupKey: randomUUID() }
            : {}),
          isMeteredPlatformFeed: this.meteredPlatformFeedValue(
            finalUrl,
            platformUrls,
            user.featureFlags,
          ),
          ...meteredRateOverrides,
        },
      },
      this.feedLimitScope({
        workspaceId: destinationWorkspaceId ?? null,
        ownerDiscordUserId: sourceFeed.user.discordUserId,
        maxFeeds,
      }),
    );

    await this.deps.feedCredentialsService.syncLookupKeys({
      feedIds: [created.id],
    });

    // Non-reddit platform clones must not keep a credentialed lookup key:
    // those providers fetch keyless on the plain URL. Reddit keeps its key —
    // its fetches carry the owner's grant through the credentialed path.
    if (isPlatformUrl && !isRedditFeedUrl(finalUrl)) {
      await this.deps.userFeedRepository.bulkUpdateLookupKeys([
        { feedId: created.id, action: "unset" },
      ]);
    }

    for (const c of sourceFeed.connections.discordChannels) {
      await this.deps.feedConnectionsDiscordChannelsService.cloneConnection(
        c,
        {
          targetFeedSelectionType: UserFeedTargetFeedSelectionType.Selected,
          name: c.name,
          targetFeedIds: [created.id],
        },
        userAccessToken,
        sourceFeed.user.discordUserId,
      );
    }

    return { id: created.id };
  }

  async copySettings({
    sourceFeed,
    dto: {
      targetFeedIds: inputTargetFeedIds,
      settings: settingsToCopy,
      targetFeedSearch,
      targetFeedSelectionType,
      targetFeedExcludeIds,
    },
    discordUserId,
  }: {
    sourceFeed: IUserFeed;
    dto: CopyUserFeedSettingsInput;
    discordUserId: string;
  }) {
    const target: CopySettingsTarget = {
      type:
        targetFeedSelectionType === UserFeedTargetFeedSelectionType.All
          ? "all"
          : "selected",
      feedIds: inputTargetFeedIds,
      search: targetFeedSearch,
      excludeFeedId: sourceFeed.id,
      excludeFeedIds: targetFeedExcludeIds,
      ownerDiscordUserId: discordUserId,
    };

    const copyableSettings: CopyableSettings = {};

    if (settingsToCopy.includes(UserFeedCopyableSetting.PassingComparisons)) {
      copyableSettings.passingComparisons = sourceFeed.passingComparisons;
    }

    if (settingsToCopy.includes(UserFeedCopyableSetting.BlockingComparisons)) {
      copyableSettings.blockingComparisons = sourceFeed.blockingComparisons;
    }

    if (settingsToCopy.includes(UserFeedCopyableSetting.ExternalProperties)) {
      copyableSettings.externalProperties = sourceFeed.externalProperties;
    }

    if (settingsToCopy.includes(UserFeedCopyableSetting.DateChecks)) {
      copyableSettings.dateCheckOptions = sourceFeed.dateCheckOptions;
    }

    if (
      settingsToCopy.includes(UserFeedCopyableSetting.DatePlaceholderSettings)
    ) {
      copyableSettings.formatOptions = {
        ...sourceFeed.formatOptions,
        dateFormat: sourceFeed.formatOptions?.dateFormat,
        dateTimezone: sourceFeed.formatOptions?.dateTimezone,
        dateLocale: sourceFeed.formatOptions?.dateLocale,
      };
    }

    if (settingsToCopy.includes(UserFeedCopyableSetting.RefreshRate)) {
      if (sourceFeed.userRefreshRateSeconds) {
        copyableSettings.userRefreshRateSeconds =
          sourceFeed.userRefreshRateSeconds;
      } else {
        copyableSettings.userRefreshRateSeconds = null;
      }
    }

    if (settingsToCopy.includes(UserFeedCopyableSetting.Connections)) {
      const feedsWithApplicationWebhooks =
        await this.deps.userFeedRepository.findFeedsWithApplicationOwnedWebhooks(
          target,
        );

      await Promise.all(
        feedsWithApplicationWebhooks.map(async (f) => {
          await Promise.all(
            f.connections.discordChannels.map(async (c) => {
              if (c.details.webhook?.isApplicationOwned === true) {
                await this.deps.feedConnectionsDiscordChannelsService.deleteConnection(
                  f.id,
                  c.id,
                );
              }
            }),
          );
        }),
      );

      copyableSettings.connections = sourceFeed.connections;
    }

    // A source rate below the premium floor cannot legally land on floor-bearing
    // premium targets; those fall back to their floored base rate instead. The
    // copy is split into two writes so non-premium and reddit targets still
    // receive the source rate.
    const sourceRate = sourceFeed.userRefreshRateSeconds ?? null;
    const subFloorSourceRate =
      settingsToCopy.includes(UserFeedCopyableSetting.RefreshRate) &&
      sourceRate !== null &&
      sourceRate <
        this.deps.config.BACKEND_API_PREMIUM_FEEDS_MIN_REFRESH_RATE_SECONDS;

    if (subFloorSourceRate) {
      const targetFeeds =
        await this.deps.userFeedRepository.findFeedUrlsForCopyTarget(target);
      const platformUrls = await this.classifyPlatformUrls(
        targetFeeds.map((feed) => feed.url),
      );
      const premiumIds = targetFeeds
        .filter(
          (feed) =>
            platformUrls.has(feed.url) &&
            appliesPremiumRefreshRateFloor(feed.url),
        )
        .map((feed) => feed.id);

      if (premiumIds.length === 0) {
        await this.deps.userFeedRepository.copySettingsToFeeds({
          target,
          settings: copyableSettings,
        });

        return;
      }

      const premiumTarget: CopySettingsTarget = {
        ...target,
        type: "selected",
        feedIds: premiumIds,
      };
      const regularIds = targetFeeds
        .map((feed) => feed.id)
        .filter((id) => !premiumIds.includes(id));

      if (regularIds.length) {
        await this.deps.userFeedRepository.copySettingsToFeeds({
          target: { ...target, type: "selected", feedIds: regularIds },
          settings: copyableSettings,
        });
      }

      await this.deps.userFeedRepository.copySettingsToFeeds({
        target: premiumTarget,
        settings: { ...copyableSettings, userRefreshRateSeconds: null },
      });

      return;
    }

    await this.deps.userFeedRepository.copySettingsToFeeds({
      target,
      settings: copyableSettings,
    });
  }

  async getFeedRequests({
    feed,
    url,
    query,
    user: existingUser,
  }: {
    feed: IUserFeed;
    url: string;
    query: Record<string, string>;
    user?: IUser;
  }) {
    const user =
      existingUser ??
      (await this.deps.usersService.getOrCreateUserByDiscordId(
        feed.user.discordUserId,
      ));

    const lookupDetails =
      await this.deps.feedCredentialsService.getLookupDetails({ feed, user });

    const response = (await this.deps.feedFetcherApiService.getRequests({
      query,
      url: lookupDetails?.url || url,
      requestLookupKey: lookupDetails?.key,
    })) as {
      result?: {
        requests?: Array<{
          createdAt: number;
          status: string;
          freshnessLifetimeMs?: number | null;
          nextRetryAtIso?: string | null;
        }>;
        nextRetryTimestamp?: number | null;
        nextRetryAtIso?: string | null;
        nextRetryReason?: NextRetryReason | null;
      };
    };

    if (response?.result) {
      const next = this.computeNextRetry({
        feed,
        latestRequest: response.result.requests?.[0],
        nextRetryTimestamp: response.result.nextRetryTimestamp,
      });
      response.result.nextRetryAtIso = next.atIso;
      response.result.nextRetryReason = next.reason;
      delete response.result.nextRetryTimestamp;
    }

    return response;
  }

  private computeNextRetry({
    feed,
    latestRequest,
    nextRetryTimestamp,
  }: {
    feed: IUserFeed;
    latestRequest?: {
      createdAt: number;
      status: string;
      freshnessLifetimeMs?: number | null;
    };
    nextRetryTimestamp?: number | null;
  }): { atIso: string | null; reason: NextRetryReason | null } {
    if (!latestRequest) {
      return { atIso: null, reason: null };
    }

    if (latestRequest.status !== "OK") {
      if (!nextRetryTimestamp) {
        return { atIso: null, reason: null };
      }

      return {
        atIso: new Date(nextRetryTimestamp * 1000).toISOString(),
        reason: "FAILED_RETRY_BACKOFF",
      };
    }

    const refreshRateSeconds = getEffectiveRefreshRateSeconds(feed);

    if (!refreshRateSeconds) {
      return { atIso: null, reason: null };
    }

    const freshnessSeconds = latestRequest.freshnessLifetimeMs
      ? latestRequest.freshnessLifetimeMs / 1000
      : 0;
    const cacheGated = freshnessSeconds > refreshRateSeconds;
    const effectiveIntervalSeconds = cacheGated
      ? freshnessSeconds
      : refreshRateSeconds;

    return {
      atIso: new Date(
        (latestRequest.createdAt + effectiveIntervalSeconds) * 1000,
      ).toISOString(),
      reason: cacheGated ? "HOST_CACHE" : "REFRESH_RATE",
    };
  }

  async updateFeedById(
    {
      id,
      disabledCode,
      user: existingUser,
    }: {
      id: string;
      disabledCode?: UserFeedDisabledCode;
      user?: IUser;
    },
    updates: UpdateFeedInput,
  ): Promise<IUserFeed | null> {
    let feedBenefits: Awaited<
      ReturnType<typeof this.deps.supportersService.resolveFeedBenefits>
    > | null = null;

    const feed = await this.deps.userFeedRepository.findById(id);

    if (!feed) {
      throw new Error(`Feed ${id} not found while updating feed`);
    }

    const user =
      existingUser ??
      (await this.deps.usersService.getOrCreateUserByDiscordId(
        feed.user.discordUserId,
      ));

    const useUpdateObject: Record<string, Record<string, unknown>> = {
      $set: {},
      $unset: {},
    };

    // The premium floor evaluates against the URL this request leaves the feed
    // with, so a PATCH that both re-URLs and re-rates cannot slip under the
    // floor via the old URL.
    let premiumRateUrl = feed.url;
    // Classified platform URLs among the ones this request touches; populated
    // on demand by the URL-change and rate sections below.
    let platformUrls: Set<string> | undefined;

    if (updates.title) {
      useUpdateObject.$set!.title = updates.title;
    }

    if (updates.url) {
      // Resolve credentials and lookup details from the NEW url, not the feed's
      // existing one: changing to a Reddit url must apply the authenticated lookup,
      // otherwise the validation fetch hits the raw Reddit url and is rate-limited.
      // Mirrors the create/clone paths.
      const [credentialSource, resolvedUpdatesUrl, urlChangeBenefits] =
        await Promise.all([
          this.deps.feedCredentialsService.resolveCredentialSource(feed, user),
          this.resolveInputUrl(updates.url),
          this.deps.supportersService.resolveFeedBenefits(feed),
        ]);
      feedBenefits = urlChangeBenefits;

      const inputPlatformUrls = await this.classifyPlatformUrls([
        resolvedUpdatesUrl,
      ]);

      if (
        user.featureFlags?.premiumFeeds &&
        this.isMeteredPlatformUrl(
          resolvedUpdatesUrl,
          inputPlatformUrls,
          user.featureFlags,
        )
      ) {
        await this.assertPlatformFeedAllowed({
          isMeteredPlatformUrl: true,
          user,
          isSupporter: urlChangeBenefits.isSupporter,
          ownerDiscordUserId: feed.user.discordUserId,
          workspaceId: feed.workspaceId,
          workspaceFeedLimit: urlChangeBenefits.maxFeeds,
          workspaceBaseTier: urlChangeBenefits.premiumFeedBaseTier,
          replacesPlatformFeed: this.isMeteredPlatformUrl(
            feed.url,
            new Set([feed.url]),
            user.featureFlags,
          ),
        });
      }

      const { finalUrl } = await this.checkUrlIsValid(
        resolvedUpdatesUrl,
        this.deps.feedCredentialsService.getLookupDetailsFromSource({
          feed: { url: resolvedUpdatesUrl, feedRequestLookupKey: randomUUID() },
          credentials: credentialSource,
        }),
        this.shouldUsePlatformProvider(
          resolvedUpdatesUrl,
          inputPlatformUrls,
          user.featureFlags,
          urlChangeBenefits.isSupporter,
        ),
      );

      // One batched classification covers both URLs: the new one for the gate
      // and floor, the old one for the replacement-slot semantics.
      platformUrls = await this.classifyPlatformUrls([feed.url, finalUrl]);

      await this.assertPlatformFeedAllowed({
        isMeteredPlatformUrl: this.isMeteredPlatformUrl(
          finalUrl,
          platformUrls,
          user.featureFlags,
        ),
        user,
        isSupporter: urlChangeBenefits.isSupporter,
        ownerDiscordUserId: feed.user.discordUserId,
        workspaceId: feed.workspaceId,
        workspaceFeedLimit: urlChangeBenefits.maxFeeds,
        workspaceBaseTier: urlChangeBenefits.premiumFeedBaseTier,
        replacesPlatformFeed:
          platformUrls.has(feed.url) &&
          appliesPremiumRefreshRateFloor(feed.url),
      });

      if (isRedditFeedUrl(finalUrl)) {
        this.assertRedditCredential(credentialSource);
      }

      useUpdateObject.$set!.url = finalUrl;
      useUpdateObject.$set!.inputUrl = updates.url;
      const isMeteredPlatformFeed = this.isMeteredPlatformUrl(
        finalUrl,
        platformUrls,
        user.featureFlags,
      );

      if (isMeteredPlatformFeed) {
        useUpdateObject.$set!.isMeteredPlatformFeed = true;
      } else {
        useUpdateObject.$unset!.isMeteredPlatformFeed = "";
      }
      // A feed re-URLed onto a non-reddit platform URL must not keep a
      // credentialed lookup key: those providers fetch keyless on the plain
      // URL. Reddit keeps its key — its fetches carry the owner's grant.
      if (platformUrls.has(finalUrl) && !isRedditFeedUrl(finalUrl)) {
        useUpdateObject.$unset!.feedRequestLookupKey = "";
      } else if (isRedditFeedUrl(finalUrl) && !feed.feedRequestLookupKey) {
        useUpdateObject.$set!.feedRequestLookupKey = randomUUID();
      }
      premiumRateUrl = finalUrl;

      // Recalculate slot offset when URL changes to maintain even distribution.
      // A non-metered feed becoming metered is clamped up to the floor here —
      // the stored base rate included, since the scheduler keys on it.
      const effectiveRefreshRate = this.clampMeteredPlatformRefreshRateSeconds(
        finalUrl,
        platformUrls.has(finalUrl),
        feed.userRefreshRateSeconds ??
          feed.refreshRateSeconds ??
          this.deps.supportersService.defaultRefreshRateSeconds,
        user.featureFlags,
      );
      useUpdateObject.$set!.slotOffsetMs = calculateSlotOffsetMs(
        finalUrl,
        effectiveRefreshRate,
      );

      if (
        platformUrls.has(finalUrl) &&
        !platformUrls.has(feed.url) &&
        (feed.refreshRateSeconds ?? 0) < effectiveRefreshRate
      ) {
        useUpdateObject.$set!.refreshRateSeconds = effectiveRefreshRate;
      }
    }

    if (updates.disabledCode !== undefined) {
      if (!feedBenefits) {
        feedBenefits =
          await this.deps.supportersService.resolveFeedBenefits(feed);
      }

      if (
        updates.disabledCode === null &&
        disabledCode &&
        DISABLED_CODES_FOR_EXCEEDED_FEED_LIMITS.includes(disabledCode)
      ) {
        if (feed.workspaceId) {
          const currentFeedCount =
            await this.deps.userFeedRepository.countByWorkspaceExcludingDisabled(
              feed.workspaceId,
              DISABLED_CODES_FOR_EXCEEDED_FEED_LIMITS,
            );

          if (feedBenefits.maxFeeds <= currentFeedCount) {
            throw new FeedLimitReachedException(
              `Cannot enable feed ${id} because workspace ${feed.workspaceId} has reached the feed limit`,
            );
          }
        } else {
          const currentFeedCount =
            await this.deps.userFeedRepository.countByOwnershipExcludingDisabled(
              user.discordUserId,
              DISABLED_CODES_FOR_EXCEEDED_FEED_LIMITS,
            );

          if (feedBenefits.maxFeeds <= currentFeedCount) {
            throw new FeedLimitReachedException(
              `Cannot enable feed ${id} because user ${user.discordUserId} has reached the feed limit`,
            );
          }
        }
      }

      if (updates.disabledCode !== null) {
        useUpdateObject.$set!.disabledCode = updates.disabledCode;
      } else {
        useUpdateObject.$unset!.disabledCode = "";
      }
    }

    if (updates.passingComparisons) {
      useUpdateObject.$set!.passingComparisons = updates.passingComparisons;
    }

    if (updates.blockingComparisons) {
      useUpdateObject.$set!.blockingComparisons = updates.blockingComparisons;
    }

    if (updates.formatOptions) {
      useUpdateObject.$set!.formatOptions = updates.formatOptions;
    }

    if (updates.dateCheckOptions) {
      useUpdateObject.$set!.dateCheckOptions = updates.dateCheckOptions;
    }

    if (updates.shareManageOptions) {
      useUpdateObject.$set!.shareManageOptions = updates.shareManageOptions;
    }

    if (updates.externalProperties) {
      useUpdateObject.$set!.externalProperties = updates.externalProperties;
    }

    if (updates.userRefreshRateSeconds !== undefined) {
      if (!feedBenefits) {
        feedBenefits =
          await this.deps.supportersService.resolveFeedBenefits(feed);
      }

      const { refreshRateSeconds: fastestPossibleRate } = feedBenefits;

      // The metered platform floor applies to the effective rate, so a
      // null/unset (base-rate) request only fails when the stored base rate
      // itself is below the floor — which the create path prevents.
      platformUrls ??= await this.classifyPlatformUrls([premiumRateUrl]);
      const premiumFloorSeconds =
        platformUrls.has(premiumRateUrl) &&
        appliesPremiumRefreshRateFloor(premiumRateUrl)
          ? this.deps.config.BACKEND_API_PREMIUM_FEEDS_MIN_REFRESH_RATE_SECONDS
          : 0;
      const refreshRateLimits = resolveRefreshRateLimits({
        planMinimumSeconds: fastestPossibleRate,
        premiumFloorSeconds,
      });
      const requestedRate =
        updates.userRefreshRateSeconds === null
          ? (feed.refreshRateSeconds ??
            this.deps.supportersService.defaultRefreshRateSeconds)
          : updates.userRefreshRateSeconds;
      // A null request resets to the stored base rate: the plan floor does not
      // govern that reset, only the platform floor (as before).
      const requestedRateMinimum =
        updates.userRefreshRateSeconds === null
          ? premiumFloorSeconds
          : refreshRateLimits.minimumSeconds;

      if (requestedRate < requestedRateMinimum) {
        throw new RefreshRateNotAllowedException(
          requestedRateMinimum === premiumFloorSeconds &&
            premiumFloorSeconds > 0
            ? `Refresh rate is too low. Premium feeds must refresh at least once every ${Math.ceil(premiumFloorSeconds / 60)} minutes.`
            : `Refresh rate is too low. Must be at least ${refreshRateLimits.minimumSeconds} seconds.`,
        );
      }

      if (
        updates.userRefreshRateSeconds === null ||
        updates.userRefreshRateSeconds === fastestPossibleRate
      ) {
        useUpdateObject.$unset!.userRefreshRateSeconds = "";

        // Recalculate slot offset based on the new effective rate
        const newEffectiveRate =
          feed.refreshRateSeconds ??
          this.deps.supportersService.defaultRefreshRateSeconds;
        useUpdateObject.$set!.slotOffsetMs = calculateSlotOffsetMs(
          feed.url,
          newEffectiveRate,
        );
      } else if (
        updates.userRefreshRateSeconds > refreshRateLimits.maximumSeconds
      ) {
        throw new RefreshRateNotAllowedException(
          `Refresh rate is too high. Maximum is ${refreshRateLimits.maximumSeconds} seconds (24 hours).`,
        );
      } else {
        useUpdateObject.$set!.userRefreshRateSeconds =
          updates.userRefreshRateSeconds;

        // Recalculate slot offset based on the new user refresh rate
        useUpdateObject.$set!.slotOffsetMs = calculateSlotOffsetMs(
          feed.url,
          updates.userRefreshRateSeconds,
        );
      }
    }

    if (
      updates.scheduleMode === UserFeedScheduleMode.Scheduled &&
      updates.schedule
    ) {
      useUpdateObject.$set!.scheduleMode = updates.scheduleMode;
      const days = updates.schedule.days?.length
        ? [...new Set(updates.schedule.days)].sort((a, b) => a - b)
        : undefined;

      useUpdateObject.$set!.schedule = {
        // Normalized to sorted so every consumer sees a stable ordering.
        times: [...updates.schedule.times].sort(),
        timezone: updates.schedule.timezone,
        // An empty days array is the same as absent: every day.
        ...(days ? { days } : {}),
      };
    } else if (updates.scheduleMode === UserFeedScheduleMode.Interval) {
      useUpdateObject.$unset!.scheduleMode = "";
      useUpdateObject.$unset!.schedule = "";
    }

    const u = await this.deps.userFeedRepository.findOneAndUpdate(
      {
        _id: new Types.ObjectId(id),
      },
      useUpdateObject,
      {
        new: true,
      },
    );

    if (updates.url) {
      // A url change can flip the feed's credential requirement (e.g. to/from a
      // Reddit url), so resync the lookup key or delivery fetches with a stale key.
      await this.deps.feedCredentialsService.syncLookupKeys({ feedIds: [id] });
    }
    if (
      u &&
      (updates.disabledCode === null ||
        (updates.disabledCode &&
          DISABLED_CODES_FOR_EXCEEDED_FEED_LIMITS.includes(
            updates.disabledCode,
          )))
    ) {
      if (u.workspaceId) {
        await this.enforceWorkspaceFeedLimit(u.workspaceId);
      } else {
        await this.enforceUserFeedLimit(u.user.discordUserId);
      }
    }

    return u;
  }

  async deleteFeedById(id: string): Promise<IUserFeed | null> {
    const feed = await this.deps.userFeedRepository.findById(id);

    if (!feed) {
      return null;
    }

    if (this.deps.feedConnectionsDiscordChannelsService) {
      await Promise.all(
        feed.connections.discordChannels.map((conn) =>
          this.deps.feedConnectionsDiscordChannelsService!.deleteConnection(
            id,
            conn.id,
          ),
        ),
      );
    }

    await this.deps.userFeedRepository.deleteById(id);

    await this.deps.publishMessage(MessageBrokerQueue.FeedDeleted, {
      data: { feedId: id },
    });

    try {
      if (feed.workspaceId) {
        await this.enforceWorkspaceFeedLimit(feed.workspaceId);
      } else {
        await this.enforceUserFeedLimit(feed.user.discordUserId);
      }
    } catch (err) {
      logger.error("Failed to enforce feed limit after deleting feed", {
        feedId: id,
        discordUserId: feed.user.discordUserId,
        workspaceId: feed.workspaceId,
        error: (err as Error).stack,
      });
    }

    return feed;
  }

  // Account erasure: deletes every personal feed (no workspaceId) the user
  // owns, routing each through deleteFeedById so the Discord connection cleanup
  // and feed-deleted event fire per feed. Workspace feeds are untouched (they
  // belong to the workspace, not the departing user). Idempotent: a re-run
  // after some feeds are already gone simply finds fewer.
  async deletePersonalFeedsForUser(discordUserId: string): Promise<number> {
    const feedIds =
      await this.deps.userFeedRepository.findPersonalFeedIdsByOwner(
        discordUserId,
      );

    for (const feedId of feedIds) {
      await this.deleteFeedById(feedId);
    }

    return feedIds.length;
  }

  // Account erasure: removes the user from the co-manage invites of every feed
  // owned by someone else where they were invited. The feeds themselves are not
  // the user's, so only their invite entry is pulled.
  async removeCoManageInvitesForUser(discordUserId: string): Promise<void> {
    await this.deps.userFeedRepository.removeInvitesForUser(discordUserId);
  }

  async manuallyRequest(feed: IUserFeed) {
    const lastRequestTime = feed.lastManualRequestAt || new Date(0);
    const waitDurationSeconds = getEffectiveRefreshRateSeconds(feed, 10 * 60)!;
    const secondsSinceLastRequest = dayjs().diff(
      dayjs(lastRequestTime),
      "seconds",
    );

    if (secondsSinceLastRequest < waitDurationSeconds) {
      throw new ManualRequestTooSoonException(
        `Feed ${feed.id} was manually requested too soon after the last request`,
        {
          secondsUntilNextRequest:
            waitDurationSeconds - secondsSinceLastRequest,
        },
      );
    }

    // A successful request would re-enable the feed, so the scope must be
    // within its feed limit first. Checked before fetching so a doomed retry
    // does not consume the rate-limited manual attempt.
    if (
      feed.disabledCode &&
      MANUALLY_RETRYABLE_DISABLED_CODES.includes(feed.disabledCode)
    ) {
      const { maxFeeds, dormant } =
        await this.deps.supportersService.resolveFeedBenefits(feed);

      if (feed.workspaceId) {
        if (dormant) {
          throw new WorkspaceNotSubscribedException(
            `Workspace ${feed.workspaceId} has no active subscription`,
          );
        }

        const currentFeedCount =
          await this.deps.userFeedRepository.countByWorkspaceExcludingDisabled(
            feed.workspaceId,
            DISABLED_CODES_FOR_EXCEEDED_FEED_LIMITS,
          );

        // The count includes this feed (failure codes still hold a limit
        // slot), so only a scope strictly over its limit is blocked.
        if (currentFeedCount > maxFeeds) {
          throw new FeedLimitReachedException(
            `Cannot re-enable feed ${feed.id} because workspace ${feed.workspaceId} has reached the feed limit`,
          );
        }
      } else {
        const currentFeedCount =
          await this.deps.userFeedRepository.countByOwnershipExcludingDisabled(
            feed.user.discordUserId,
            DISABLED_CODES_FOR_EXCEEDED_FEED_LIMITS,
          );

        if (currentFeedCount > maxFeeds) {
          throw new FeedLimitReachedException(
            `Cannot re-enable feed ${feed.id} because user ${feed.user.discordUserId} has reached the feed limit`,
          );
        }
      }
    }

    const requestDate = new Date();
    const user = await this.deps.usersService.getOrCreateUserByDiscordId(
      feed.user.discordUserId,
    );

    await this.deps.feedCredentialsService.syncLookupKeys({
      feedIds: [feed.id],
    });
    const lookupDetails =
      await this.deps.feedCredentialsService.getLookupDetails({ feed, user });

    const res = await this.deps.feedFetcherApiService.fetchAndSave(
      lookupDetails?.url || feed.url,
      lookupDetails,
      {
        getCachedResponse: false,
        usePlatformProvider:
          feed.isMeteredPlatformFeed === true || isRedditFeedUrl(feed.url),
      },
    );

    const isRequestSuccessful =
      res.requestStatus === FeedFetcherFetchStatus.Success;
    let canBeEnabled =
      isRequestSuccessful &&
      (!feed.disabledCode ||
        MANUALLY_RETRYABLE_DISABLED_CODES.includes(feed.disabledCode));

    let getArticlesRequestStatus: GetArticlesResponseRequestStatus | null =
      null;

    if (
      isRequestSuccessful &&
      feed.disabledCode === UserFeedDisabledCode.InvalidFeed
    ) {
      const res2 = await this.getFeedArticleProperties({
        feed,
        url: feed.url,
      });

      getArticlesRequestStatus = res2.requestStatus;

      canBeEnabled =
        isRequestSuccessful &&
        res2.requestStatus === GetArticlesResponseRequestStatus.Success;
    }

    const updateDoc: Record<string, unknown> = {
      $set: {
        lastManualRequestAt: requestDate,
        healthStatus: isRequestSuccessful
          ? UserFeedHealthStatus.Ok
          : feed.healthStatus,
      },
    };

    if (canBeEnabled) {
      updateDoc.$unset = { disabledCode: "" };
    }

    await this.deps.userFeedRepository.findOneAndUpdate(
      { _id: new Types.ObjectId(feed.id) },
      updateDoc,
    );

    return {
      requestStatus: res.requestStatus,
      requestStatusCode:
        res.requestStatus === FeedFetcherFetchStatus.BadStatusCode
          ? res.response?.statusCode
          : undefined,
      getArticlesRequestStatus,
      hasEnabledFeed: canBeEnabled,
    };
  }

  async getFeedArticleProperties({
    url,
    customPlaceholders,
    feed,
    user: existingUser,
  }: GetFeedArticlePropertiesInput): Promise<GetFeedArticlePropertiesOutput> {
    const input: GetArticlesInput = {
      url,
      limit: 10,
      random: false,
      skip: 0,
      selectProperties: ["*"],
      formatter: {
        options: {
          formatTables: false,
          stripImages: false,
          dateFormat: undefined,
          dateTimezone: undefined,
          disableImageLinkPreviews: false,
          dateLocale: undefined,
        },
        customPlaceholders,
        externalProperties: feed.externalProperties?.map((p) => ({
          ...p,
        })),
      },
    };

    const user =
      existingUser ??
      (await this.deps.usersService.getOrCreateUserByDiscordId(
        feed.user.discordUserId,
      ));

    const { articles, requestStatus } =
      await this.deps.feedHandlerService.getArticles(
        {
          ...input,
          usePlatformProvider:
            feed.isMeteredPlatformFeed === true || isRedditFeedUrl(feed.url),
        },
        await this.deps.feedCredentialsService.getLookupDetails({ feed, user }),
      );

    const properties = Array.from(
      new Set(articles.map((article) => Object.keys(article)).flat()),
    ).sort();

    return {
      requestStatus,
      properties,
    };
  }
  async getFeedDailyLimit(feed: IUserFeed) {
    const { articleRateLimits } =
      await this.deps.supportersService.resolveFeedBenefits(feed);

    const dailyLimit = articleRateLimits.find(
      (limit) => limit.timeWindowSeconds === 86400,
    );

    if (!dailyLimit) {
      throw new Error(
        `Daily limit was not found for feed ${feed.id} whose owner is ${feed.user.discordUserId}`,
      );
    }

    const currentProgress = await this.deps.feedHandlerService.getDeliveryCount(
      {
        feedId: feed.id,
        timeWindowSec: 86400,
      },
    );

    return {
      progress: currentProgress.result.count,
      max: dailyLimit?.max,
    };
  }

  async getFeedArticles({
    limit,
    url,
    random,
    filters,
    selectProperties,
    selectPropertyTypes,
    skip,
    formatter,
    discordUserId,
    feed,
    includeHtmlInErrors,
    user: existingUser,
  }: GetFeedArticlesInput): Promise<GetFeedArticlesOutput> {
    const user =
      existingUser ??
      (await this.deps.usersService.getOrCreateUserByDiscordId(discordUserId));

    return this.deps.feedHandlerService.getArticles(
      {
        url,
        limit,
        random,
        filters,
        skip: skip || 0,
        selectProperties,
        selectPropertyTypes,
        includeHtmlInErrors,
        usePlatformProvider:
          feed.isMeteredPlatformFeed === true || isRedditFeedUrl(feed.url),
        formatter: {
          ...formatter,
          options: {
            ...formatter?.options,
            dateFormat:
              formatter.options.dateFormat || user?.preferences?.dateFormat,
            dateTimezone:
              formatter.options.dateTimezone || user?.preferences?.dateTimezone,
            dateLocale:
              formatter.options.dateLocale || user?.preferences?.dateLocale,
          },
        },
      },
      await this.deps.feedCredentialsService.getLookupDetails({ feed, user }),
    );
  }

  async bulkDelete(
    feedIds: string[],
  ): Promise<Array<{ id: string; deleted: boolean }>> {
    const feeds = await this.deps.userFeedRepository.findByIds(feedIds);
    const foundIds = new Set(feeds.map((f) => f.id));

    if (this.deps.feedConnectionsDiscordChannelsService) {
      const deletePromises = feeds.flatMap((feed) =>
        feed.connections.discordChannels.map((conn) =>
          this.deps
            .feedConnectionsDiscordChannelsService!.deleteConnection(
              feed.id,
              conn.id,
            )
            .catch((err) => {
              logger.error(
                "Failed to delete feed connection during bulk delete",
                {
                  feedId: feed.id,
                  connectionId: conn.id,
                  error: (err as Error).stack,
                },
              );
            }),
        ),
      );
      await Promise.all(deletePromises);
    }

    if (foundIds.size > 0) {
      await this.deps.userFeedRepository.deleteByIds(feeds.map((f) => f.id));
    }

    const userIds = [
      ...new Set(
        feeds.filter((f) => !f.workspaceId).map((f) => f.user.discordUserId),
      ),
    ];
    const workspaceIds = [
      ...new Set(
        feeds.map((f) => f.workspaceId).filter((id): id is string => !!id),
      ),
    ];

    try {
      await Promise.all([
        ...userIds.map((userId) => this.enforceUserFeedLimit(userId)),
        ...workspaceIds.map((workspaceId) =>
          this.enforceWorkspaceFeedLimit(workspaceId),
        ),
      ]);
    } catch (err) {
      logger.error("Failed to enforce feed limits after bulk delete", {
        userIds,
        workspaceIds,
        error: (err as Error).stack,
      });
    }

    for (
      let index = 0;
      index < feeds.length;
      index += BULK_DELETE_PUBLISH_CONCURRENCY
    ) {
      await Promise.all(
        feeds
          .slice(index, index + BULK_DELETE_PUBLISH_CONCURRENCY)
          .map((feed) =>
            this.deps.publishMessage(MessageBrokerQueue.FeedDeleted, {
              data: { feedId: feed.id },
            }),
          ),
      );
    }

    return feedIds.map((id) => ({
      id,
      deleted: foundIds.has(id),
    }));
  }

  async bulkDisable(
    feedIds: string[],
  ): Promise<Array<{ id: string; disabled: boolean }>> {
    const [eligibleFeeds, userIds, workspaceIds] = await Promise.all([
      this.deps.userFeedRepository.findEligibleFeedsForDisable(
        feedIds,
        DISABLED_CODES_FOR_EXCEEDED_FEED_LIMITS,
      ),
      this.deps.userFeedRepository.findDiscordUserIdsByFeedIds(feedIds),
      this.deps.userFeedRepository.findWorkspaceIdsByFeedIds(feedIds),
    ]);
    const eligibleIds = new Set(eligibleFeeds.map((f) => f.id));

    if (eligibleIds.size > 0) {
      await this.deps.userFeedRepository.updateManyByFilter(
        { _id: { $in: Array.from(eligibleIds) } },
        { $set: { disabledCode: UserFeedDisabledCode.Manual } },
      );
    }

    try {
      await Promise.all([
        ...userIds.map((userId) => this.enforceUserFeedLimit(userId)),
        ...workspaceIds.map((workspaceId) =>
          this.enforceWorkspaceFeedLimit(workspaceId),
        ),
      ]);
    } catch (err) {
      logger.error("Failed to enforce feed limits after bulk disable", {
        userIds,
        workspaceIds,
        error: (err as Error).stack,
      });
    }

    return feedIds.map((id) => ({
      id,
      disabled: eligibleIds.has(id),
    }));
  }

  async bulkEnable(
    feedIds: string[],
  ): Promise<Array<{ id: string; enabled: boolean }>> {
    const [eligibleFeeds, userIds, workspaceIds] = await Promise.all([
      this.deps.userFeedRepository.findEligibleFeedsForEnable(feedIds),
      this.deps.userFeedRepository.findDiscordUserIdsByFeedIds(feedIds),
      this.deps.userFeedRepository.findWorkspaceIdsByFeedIds(feedIds),
    ]);
    const eligibleIds = new Set(eligibleFeeds.map((f) => f.id));

    if (eligibleIds.size > 0) {
      await this.deps.userFeedRepository.updateManyByFilter(
        { _id: { $in: Array.from(eligibleIds) } },
        { $unset: { disabledCode: 1 } },
      );
    }

    try {
      await Promise.all([
        ...userIds.map((userId) => this.enforceUserFeedLimit(userId)),
        ...workspaceIds.map((workspaceId) =>
          this.enforceWorkspaceFeedLimit(workspaceId),
        ),
      ]);
    } catch (err) {
      logger.error("Failed to enforce feed limits after bulk enable", {
        userIds,
        workspaceIds,
        error: (err as Error).stack,
      });
    }

    return feedIds.map((id) => ({
      id,
      enabled: eligibleIds.has(id),
    }));
  }

  async validateFeedUrl(
    opts: { discordUserId: string },
    input: {
      url: string;
      workspaceId?: string;
      replacesFeed?: IUserFeed;
    },
  ): Promise<ValidateFeedUrlOutput> {
    const { discordUserId } = opts;
    const { url, workspaceId, replacesFeed } = input;

    const user =
      await this.deps.usersService.getOrCreateUserByDiscordId(discordUserId);

    if (workspaceId) {
      await this.deps.workspacesService.getWorkspaceForMember(
        workspaceId,
        user.id,
      );
    }

    const [credentialSource, resolvedUrl, feedBenefits] = await Promise.all([
      this.deps.feedCredentialsService.resolveCredentialSource(
        { workspaceId },
        user,
      ),
      this.resolveInputUrl(url),
      this.deps.supportersService.resolveFeedBenefits({
        workspaceId,
        user: { discordUserId },
      }),
    ]);

    const lookupDetails =
      this.deps.feedCredentialsService.getLookupDetailsFromSource({
        feed: { url: resolvedUrl, feedRequestLookupKey: randomUUID() },
        credentials: credentialSource,
      });

    const platformUrls = await this.classifyPlatformUrls([resolvedUrl]);

    if (
      this.isMeteredPlatformUrl(resolvedUrl, platformUrls, user.featureFlags)
    ) {
      await this.assertPlatformFeedAllowed({
        isMeteredPlatformUrl: true,
        user,
        isSupporter: feedBenefits.isSupporter,
        ownerDiscordUserId: discordUserId,
        workspaceId,
        workspaceFeedLimit: feedBenefits.maxFeeds,
        workspaceBaseTier: feedBenefits.premiumFeedBaseTier,
        replacesPlatformFeed: replacesFeed
          ? this.isMeteredPlatformUrl(
              replacesFeed.url,
              new Set([replacesFeed.url]),
              user.featureFlags,
            )
          : false,
      });
    }

    const { finalUrl, feedTitle } = await this.checkUrlIsValid(
      resolvedUrl,
      lookupDetails,
      this.shouldUsePlatformProvider(
        resolvedUrl,
        platformUrls,
        user.featureFlags,
        feedBenefits.isSupporter,
      ),
    );

    if (finalUrl !== url) {
      return {
        resolvedToUrl: finalUrl,
        feedTitle,
      };
    }

    return { resolvedToUrl: null, feedTitle };
  }

  async previewFeedByUrl(
    opts: { discordUserId: string },
    input: { url: string; workspaceId?: string },
  ): Promise<PreviewFeedByUrlOutput> {
    const { discordUserId } = opts;
    const { url, workspaceId } = input;

    const user =
      await this.deps.usersService.getOrCreateUserByDiscordId(discordUserId);

    if (workspaceId) {
      await this.deps.workspacesService.getWorkspaceForMember(
        workspaceId,
        user.id,
      );
    }

    const lookupDetails =
      await this.deps.feedCredentialsService.getLookupDetails({
        feed: { url, feedRequestLookupKey: randomUUID(), workspaceId },
        user,
      });

    const getArticlesResponse = await this.deps.feedHandlerService.getArticles(
      {
        url,
        formatter: {
          options: {
            dateFormat: undefined,
            dateLocale: undefined,
            dateTimezone: undefined,
            disableImageLinkPreviews: false,
            formatTables: false,
            stripImages: false,
          },
        },
        selectProperties: ["title", "date", "description", "link"],
        limit: 5,
        skip: 0,
        findRssFromHtml: false,
        executeFetchIfStale: true,
      },
      lookupDetails,
    );

    const {
      requestStatus,
      response,
      articles: rawArticles,
    } = getArticlesResponse;

    if (requestStatus !== GetArticlesResponseRequestStatus.Success) {
      return {
        articles: [],
        requestStatus,
        responseStatusCode: response?.statusCode,
      };
    }

    const articles: PreviewFeedByUrlArticle[] = rawArticles.map((raw) => {
      let title = raw.title;

      if (!title && raw.description) {
        title =
          raw.description.length > 80
            ? raw.description.slice(0, 80) + "..."
            : raw.description;
      }

      if (!title && raw.link) {
        try {
          const pathname = new URL(raw.link).pathname;
          const lastSegment = pathname.split("/").filter(Boolean).pop();

          if (lastSegment) {
            title = decodeURIComponent(lastSegment);
          }
        } catch {
          // invalid URL, fall through
        }
      }

      if (!title) {
        title = "Untitled article";
      }

      const article: PreviewFeedByUrlArticle = { title };

      if (raw.date) {
        article.date = raw.date;
      }

      if (raw.link) {
        article.url = raw.link;
      }

      return article;
    });

    const withDates = articles.filter((a) => a.date);
    const withoutDates = articles.filter((a) => !a.date);

    withDates.sort(
      (a, b) => new Date(b.date!).getTime() - new Date(a.date!).getTime(),
    );

    return {
      articles: [...withDates, ...withoutDates],
      requestStatus,
    };
  }

  async deduplicateFeedUrls(
    discordUserId: string,
    urls: string[],
  ): Promise<string[]> {
    const existingFeeds = await this.deps.userFeedRepository.findByUrls(
      discordUserId,
      urls,
    );
    const existingUrls = new Set(existingFeeds.map((f) => f.url));

    return urls.filter((url) => !existingUrls.has(url));
  }

  async enforceUserFeedLimit(discordUserId: string): Promise<void> {
    const { isSupporter, refreshRateSeconds, maxUserFeeds } =
      await this.deps.supportersService.getBenefitsOfDiscordUser(discordUserId);

    await this.deps.userFeedRepository.enforceWebhookConnections({
      type: "single-user",
      allowWebhooks: isSupporter,
      discordUserId,
    });

    await this.deps.userFeedRepository.enforceRefreshRates(
      {
        type: "single-user",
        discordUserId,
        refreshRateSeconds,
      },
      this.deps.supportersService.defaultSupporterRefreshRateSeconds,
    );

    const { feedIdsToDisable, feedIdsToEnable } = isSupporter
      ? await this.collectFeedIdsForSupporterLimits({
          type: "single-user",
          discordUserId,
          maxUserFeeds,
        })
      : await this.collectFeedIdsForNonSupporterLimits({
          type: "single-user",
          discordUserId,
        });

    await this.deps.userFeedRepository.disableFeedsByIds(
      feedIdsToDisable,
      UserFeedDisabledCode.ExceededFeedLimit,
    );
    await this.deps.userFeedRepository.enableFeedsByIds(feedIdsToEnable);
  }

  async enforceAllUserFeedLimits(
    supporterLimits: Array<{
      discordUserId: string;
      maxUserFeeds: number;
      refreshRateSeconds: number;
    }>,
  ) {
    const supporterDiscordUserIds = supporterLimits.map(
      ({ discordUserId }) => discordUserId,
    );

    await this.deps.userFeedRepository.enforceWebhookConnections({
      type: "all-users",
      supporterDiscordUserIds,
    });

    await this.deps.userFeedRepository.enforceRefreshRates(
      {
        type: "all-users",
        supporterLimits,
      },
      this.deps.supportersService.defaultSupporterRefreshRateSeconds,
    );

    const [nonSupporterLimits, supporterLimitResults] = await Promise.all([
      this.collectFeedIdsForNonSupporterLimits({
        type: "all-users",
        supporterDiscordUserIds,
      }),
      this.collectFeedIdsForSupporterLimits({
        type: "all-users",
        supporterLimits,
      }),
    ]);

    const feedIdsToDisable = [
      ...nonSupporterLimits.feedIdsToDisable,
      ...supporterLimitResults.feedIdsToDisable,
    ];
    const feedIdsToEnable = [
      ...nonSupporterLimits.feedIdsToEnable,
      ...supporterLimitResults.feedIdsToEnable,
    ];

    await this.deps.userFeedRepository.disableFeedsByIds(
      feedIdsToDisable,
      UserFeedDisabledCode.ExceededFeedLimit,
    );
    await this.deps.userFeedRepository.enableFeedsByIds(feedIdsToEnable);
  }

  async enforceWorkspaceFeedLimit(workspaceId: string): Promise<void> {
    const { maxFeeds, refreshRateSeconds, allowWebhooks } =
      await this.deps.supportersService.getWorkspaceBenefits(workspaceId);

    await this.deps.userFeedRepository.enforceWorkspaceWebhookConnections({
      type: "single-workspace",
      workspaceId,
      allowWebhooks,
    });

    await this.deps.userFeedRepository.enforceWorkspaceRefreshRates(
      {
        type: "single-workspace",
        workspaceId,
        refreshRateSeconds,
      },
      this.deps.supportersService.defaultSupporterRefreshRateSeconds,
    );

    const results = await this.collectFeedIdsForWorkspaceLimits(
      { type: "include", workspaceIds: [workspaceId] },
      () => maxFeeds,
    );

    // While a conversion is in flight, the just-moved feeds outnumber the
    // not-yet-recorded subscription's limit; suppress disabling so they aren't
    // flicked off in the window before the subscription record lands. Enabling
    // and refresh/webhook normalization still run.
    const guarded =
      await this.deps.workspacesService.isConversionInProgress(workspaceId);

    await this.applyWorkspaceLimitResults(
      guarded ? this.withoutDisables(results) : results,
    );
  }

  private withoutDisables(
    results: WorkspaceLimitEnforcementOutcome[],
  ): WorkspaceLimitEnforcementOutcome[] {
    return results.map((r) => ({ ...r, feedIdsToDisable: [] }));
  }

  async enforceAllWorkspaceFeedLimits(): Promise<void> {
    const workspaceIds =
      await this.deps.userFeedRepository.getDistinctWorkspaceIdsWithFeeds();

    if (workspaceIds.length === 0) {
      return;
    }

    const benefitsByWorkspaceId = new Map<
      string,
      Awaited<
        ReturnType<typeof this.deps.supportersService.getWorkspaceBenefits>
      >
    >();
    await Promise.all(
      workspaceIds.map(async (id) => {
        benefitsByWorkspaceId.set(
          id,
          await this.deps.supportersService.getWorkspaceBenefits(id),
        );
      }),
    );

    const supporterRefreshRateSeconds =
      this.deps.supportersService.defaultSupporterRefreshRateSeconds;

    await this.deps.userFeedRepository.enforceWorkspaceWebhookConnections({
      type: "all-workspaces",
      webhookAllowedWorkspaceIds: workspaceIds.filter(
        (id) => benefitsByWorkspaceId.get(id)?.allowWebhooks,
      ),
    });

    await this.deps.userFeedRepository.enforceWorkspaceRefreshRates(
      {
        type: "all-workspaces",
        fastRateWorkspaceIds: workspaceIds.filter(
          (id) =>
            benefitsByWorkspaceId.get(id)?.refreshRateSeconds ===
            supporterRefreshRateSeconds,
        ),
      },
      supporterRefreshRateSeconds,
    );

    const results = await this.collectFeedIdsForWorkspaceLimits(
      { type: "include", workspaceIds },
      (workspaceId) => benefitsByWorkspaceId.get(workspaceId)?.maxFeeds,
    );

    // A fresh conversion guard suppresses disabling on the sweep too; an
    // expired guard is reconciled normally (the sweep is the guard's backstop).
    // Resolved in one query rather than a per-workspace read.
    const guarded =
      await this.deps.workspacesService.conversionInProgressWorkspaceIds(
        results.map((r) => r.workspaceId),
      );

    await this.applyWorkspaceLimitResults(
      results.map((r) =>
        guarded.has(r.workspaceId) ? this.withoutDisables([r])[0]! : r,
      ),
    );
  }

  private async collectFeedIdsForWorkspaceLimits(
    query: WorkspaceFeedLimitEnforcementQuery,
    getMaxFeeds: (workspaceId: string) => number | undefined,
  ): Promise<WorkspaceLimitEnforcementOutcome[]> {
    const results: WorkspaceLimitEnforcementOutcome[] = [];

    const grouped =
      this.deps.userFeedRepository.getFeedsGroupedByWorkspaceForLimitEnforcement(
        query,
      );

    for await (const res of grouped) {
      const { workspaceId, enabledFeedIds, disabledFeedIds } = res;
      const limit = getMaxFeeds(workspaceId);

      // 0 is a meaningful limit (dormant workspace: disable everything), so
      // only an absent limit is an error.
      if (limit === undefined) {
        throw new Error(
          `No feed limit found for workspace ${workspaceId} while enforcing limits`,
        );
      }

      const enabledFeedCount = enabledFeedIds.length;
      let feedIdsToDisable: string[] = [];
      let feedIdsToEnable: string[] = [];

      if (enabledFeedCount > limit) {
        feedIdsToDisable = enabledFeedIds.slice(0, enabledFeedCount - limit);
      } else if (enabledFeedCount < limit && disabledFeedIds.length > 0) {
        const numberOfFeedsToEnable = limit - enabledFeedCount;
        feedIdsToEnable = disabledFeedIds.slice(
          Math.max(0, disabledFeedIds.length - numberOfFeedsToEnable),
        );
      }

      if (feedIdsToDisable.length > 0 || feedIdsToEnable.length > 0) {
        results.push({ workspaceId, feedIdsToDisable, feedIdsToEnable });
      }
    }

    return results;
  }

  private async applyWorkspaceLimitResults(
    results: WorkspaceLimitEnforcementOutcome[],
  ): Promise<void> {
    await this.deps.userFeedRepository.disableFeedsByIds(
      results.flatMap((r) => r.feedIdsToDisable),
      UserFeedDisabledCode.ExceededFeedLimit,
    );
    await this.deps.userFeedRepository.enableFeedsByIds(
      results.flatMap((r) => r.feedIdsToEnable),
    );

    for (const { workspaceId, feedIdsToDisable } of results) {
      if (feedIdsToDisable.length === 0) {
        continue;
      }

      try {
        const feeds =
          await this.deps.userFeedRepository.findByIdsForNotification(
            feedIdsToDisable,
          );

        await this.deps.notificationsService.sendWorkspaceFeedsDisabledDigest({
          workspaceId,
          disabledFeeds: feeds.map((feed) => ({
            id: feed.id,
            title: feed.title,
            url: feed.url,
          })),
        });
      } catch (err) {
        logger.error(
          "Failed to send disabled feeds digest after workspace limit enforcement",
          {
            workspaceId,
            error: (err as Error).stack,
          },
        );
      }
    }
  }

  async getDeliveryPreview({
    feed,
    skip,
    limit,
    user: existingUser,
  }: {
    feed: IUserFeed;
    skip: number;
    limit: number;
    user?: IUser;
  }) {
    const [user, { maxDailyArticles }] = await Promise.all([
      existingUser ??
        this.deps.usersService.getOrCreateUserByDiscordId(
          feed.user.discordUserId,
        ),
      this.deps.supportersService.resolveFeedBenefits(feed),
    ]);

    const lookupDetails =
      await this.deps.feedCredentialsService.getLookupDetails({ feed, user });

    const mediums = this.mapConnectionsToMediums(feed);

    const result = await this.deps.feedHandlerService.getDeliveryPreview({
      feed: {
        id: feed.id,
        url: feed.url,
        blockingComparisons: feed.blockingComparisons || [],
        passingComparisons: feed.passingComparisons || [],
        dateChecks: feed.dateCheckOptions,
        formatOptions: feed.formatOptions,
        externalProperties: feed.externalProperties?.map((ep) => ({
          sourceField: ep.sourceField,
          label: ep.label,
          cssSelector: ep.cssSelector,
        })),
        requestLookupDetails: lookupDetails
          ? {
              key: lookupDetails.key,
              url: lookupDetails.url,
              headers: lookupDetails.headers,
            }
          : null,
        refreshRateSeconds: getEffectiveRefreshRateSeconds(feed),
        usePlatformProvider:
          feed.isMeteredPlatformFeed === true || isRedditFeedUrl(feed.url),
      },
      mediums,
      articleDayLimit: feed.maxDailyArticles ?? maxDailyArticles,
      skip,
      limit,
    });

    return { result };
  }

  private generateFeedRequestLookupKey(): string {
    return randomUUID();
  }

  private async checkUrlIsValid(
    url: string,
    lookupDetails: FeedRequestLookupDetails | null,
    usePlatformProvider: boolean,
  ): Promise<CheckUrlIsValidOutput> {
    const getArticlesResponse = await this.deps.feedHandlerService.getArticles(
      {
        url,
        formatter: {
          options: {
            dateFormat: undefined,
            dateLocale: undefined,
            dateTimezone: undefined,
            disableImageLinkPreviews: false,
            formatTables: false,
            stripImages: false,
          },
        },
        selectProperties: ["date"],
        limit: 1,
        skip: 0,
        findRssFromHtml: true,
        executeFetchIfStale: true,
        usePlatformProvider,
      },
      lookupDetails,
    );

    const {
      requestStatus,
      url: finalUrl,
      attemptedToResolveFromHtml,
      articles,
      feedTitle,
    } = getArticlesResponse;

    if (requestStatus === GetArticlesResponseRequestStatus.Success) {
      const bannedRecord = await this.deps.feedsService.getBannedFeedDetails(
        finalUrl || url,
        "",
      );

      if (bannedRecord) {
        throw new BannedFeedException();
      }

      return {
        finalUrl: finalUrl || url,
        enableDateChecks: !!articles[0]?.date,
        feedTitle: feedTitle || undefined,
      };
    } else if (requestStatus === GetArticlesResponseRequestStatus.TimedOut) {
      throw new FeedFetchTimeoutException(`Feed fetch timed out`);
    } else if (requestStatus === GetArticlesResponseRequestStatus.ParseError) {
      if (attemptedToResolveFromHtml) {
        throw new NoFeedOnHtmlPageException(`No feed found on HTML page`);
      }

      throw new FeedParseException(
        `Feed host failed to return a valid, parseable feed`,
      );
    } else if (
      requestStatus === GetArticlesResponseRequestStatus.BadStatusCode
    ) {
      const statusCode = getArticlesResponse.response?.statusCode;

      if (!statusCode) {
        throw new FeedRequestException(`Non-200 status code returned`);
      }

      this.deps.feedFetcherService.handleStatusCode(statusCode);
    } else if (requestStatus === GetArticlesResponseRequestStatus.FetchError) {
      throw new FeedRequestException(`Feed fetch failed`);
    } else if (
      requestStatus === GetArticlesResponseRequestStatus.InvalidSslCertificate
    ) {
      throw new FeedInvalidSslCertException(
        "Issue encountered with SSL certificate",
      );
    }

    throw new Error(`Unhandled request status ${requestStatus}`);
  }

  private async collectFeedIdsForSupporterLimits(
    opts:
      | {
          type: "all-users";
          supporterLimits: Array<{
            discordUserId: string;
            maxUserFeeds: number;
          }>;
        }
      | {
          type: "single-user";
          discordUserId: string;
          maxUserFeeds: number;
        },
  ): Promise<{ feedIdsToDisable: string[]; feedIdsToEnable: string[] }> {
    const userIds =
      opts.type === "all-users"
        ? opts.supporterLimits.map((l) => l.discordUserId)
        : [opts.discordUserId];

    if (userIds.length === 0) {
      return { feedIdsToDisable: [], feedIdsToEnable: [] };
    }

    const feedLimitsByUserId: Record<string, number> =
      opts.type === "all-users"
        ? Object.fromEntries(
            opts.supporterLimits.map(({ discordUserId, maxUserFeeds }) => [
              discordUserId,
              maxUserFeeds,
            ]),
          )
        : {
            [opts.discordUserId]: opts.maxUserFeeds,
          };

    const feedIdsToDisable: string[] = [];
    const feedIdsToEnable: string[] = [];

    const results =
      this.deps.userFeedRepository.getFeedsGroupedByUserForLimitEnforcement({
        type: "include",
        discordUserIds: userIds,
      });

    for await (const res of results) {
      const { discordUserId, enabledFeedIds, disabledFeedIds } = res;
      const limit = feedLimitsByUserId[discordUserId];

      if (!limit) {
        throw new Error(
          `No feed limit found for user ${discordUserId} while enforcing limits`,
        );
      }

      const enabledFeedCount = enabledFeedIds.length;

      if (enabledFeedCount > limit) {
        const toDisable = enabledFeedIds.slice(0, enabledFeedCount - limit);
        feedIdsToDisable.push(...toDisable);
      } else if (enabledFeedCount < limit && disabledFeedIds.length > 0) {
        const numberOfFeedsToEnable = limit - enabledFeedCount;
        const toEnable = disabledFeedIds.slice(
          Math.max(0, disabledFeedIds.length - numberOfFeedsToEnable),
        );
        feedIdsToEnable.push(...toEnable);
      }
    }

    return { feedIdsToDisable, feedIdsToEnable };
  }

  private async collectFeedIdsForNonSupporterLimits(
    opts:
      | {
          type: "all-users";
          supporterDiscordUserIds: Array<string>;
        }
      | {
          type: "single-user";
          discordUserId: string;
        },
  ): Promise<{ feedIdsToDisable: string[]; feedIdsToEnable: string[] }> {
    const defaultMaxUserFeeds = this.deps.supportersService.defaultMaxUserFeeds;

    const results =
      opts.type === "single-user"
        ? this.deps.userFeedRepository.getFeedsGroupedByUserForLimitEnforcement(
            {
              type: "include",
              discordUserIds: [opts.discordUserId],
            },
          )
        : this.deps.userFeedRepository.getFeedsGroupedByUserForLimitEnforcement(
            {
              type: "exclude",
              discordUserIds: opts.supporterDiscordUserIds,
            },
          );

    const feedIdsToDisable: string[] = [];
    const feedIdsToEnable: string[] = [];

    for await (const res of results) {
      const { enabledFeedIds, disabledFeedIds } = res;

      const enabledFeedCount = enabledFeedIds.length;

      if (enabledFeedCount > defaultMaxUserFeeds) {
        const toDisable = enabledFeedIds.slice(
          0,
          enabledFeedCount - defaultMaxUserFeeds,
        );
        feedIdsToDisable.push(...toDisable);
      } else if (
        enabledFeedCount < defaultMaxUserFeeds &&
        disabledFeedIds.length > 0
      ) {
        const numberOfFeedsToEnable = defaultMaxUserFeeds - enabledFeedCount;
        const toEnable = disabledFeedIds.slice(
          Math.max(0, disabledFeedIds.length - numberOfFeedsToEnable),
        );
        feedIdsToEnable.push(...toEnable);
      }
    }

    return { feedIdsToDisable, feedIdsToEnable };
  }

  private mapConnectionsToMediums(
    feed: IUserFeed,
  ): DeliveryPreviewMediumInput[] {
    const mediums: DeliveryPreviewMediumInput[] = [];

    const connections = feed.connections?.discordChannels || [];

    for (const conn of connections) {
      if (conn.disabledCode) {
        continue;
      }

      mediums.push({
        id: conn.id,
        rateLimits: conn.rateLimits?.map((rl) => ({
          limit: rl.limit,
          timeWindowSeconds: rl.timeWindowSeconds,
        })),
        filters: conn.filters?.expression
          ? { expression: conn.filters.expression }
          : undefined,
      });
    }

    return mediums;
  }
}
