import type { Config } from "../../config";
import type { SupportersService } from "../supporters/supporters.service";
import type { UserFeedsService } from "../user-feeds/user-feeds.service";
import type { UsersService } from "../users/users.service";
import type { MessageBrokerService } from "../message-broker/message-broker.service";
import type {
  IUserFeedRepository,
  RefreshRateSyncInput,
  MaxDailyArticlesSyncInput,
  WorkspaceRefreshRateSyncInput,
  WorkspaceMaxDailyArticlesSyncInput,
  FeedForSlotOffsetRecalculation,
} from "../../repositories/interfaces/user-feed.types";
import type { SlotWindow } from "../../shared/types/slot-window.types";
import { SCHEDULER_WINDOW_SIZE_MS } from "../../shared/constants/scheduler.constants";
import { calculateSlotOffsetMs } from "../../shared/utils/fnv1a-hash";
import {
  getFeedRequestLookupDetails,
  pickFeedCredentialSource,
} from "../../shared/utils/get-feed-request-lookup-details";
import logger from "../../infra/logger";

export interface ScheduleHandlerServiceDeps {
  config: Config;
  supportersService: SupportersService;
  userFeedsService: UserFeedsService;
  usersService: UsersService;
  userFeedRepository: IUserFeedRepository;
  messageBrokerService: MessageBrokerService;
  now?: () => number;
}

interface UrlBatchItem {
  url: string;
  saveToObjectStorage?: boolean;
  lookupKey?: string;
  headers?: Record<string, string>;
}

export class ScheduleHandlerService {
  private readonly defaultRefreshRateSeconds: number;

  constructor(private readonly deps: ScheduleHandlerServiceDeps) {
    this.defaultRefreshRateSeconds =
      deps.config.BACKEND_API_DEFAULT_REFRESH_RATE_MINUTES * 60;
  }

  async emitUrlRequestBatchEvent(data: {
    rateSeconds: number;
    data: Array<UrlBatchItem>;
  }): Promise<void> {
    await this.deps.messageBrokerService.publishUrlFetchBatch(data);
    logger.debug("Successfully emitted url request batch event");
  }

  async runMaintenanceOperations(): Promise<void> {
    const allBenefits =
      await this.deps.supportersService.getBenefitsOfAllDiscordUsers();

    const refreshRateSyncInput = this.buildRefreshRateSyncInput(allBenefits);
    const maxDailyArticlesSyncInput =
      this.buildMaxDailyArticlesSyncInput(allBenefits);

    await this.deps.usersService.syncLookupKeys();
    await this.recalculateSlotOffsetsForChangedRates(refreshRateSyncInput);
    await this.deps.userFeedRepository.syncRefreshRates(refreshRateSyncInput);
    await this.deps.userFeedRepository.syncMaxDailyArticles(
      maxDailyArticlesSyncInput,
    );

    const workspaceSyncInputs = await this.buildWorkspaceSyncInputs();
    await this.recalculateSlotOffsets(
      this.deps.userFeedRepository.iterateWorkspaceFeedsForRefreshRateSync(
        workspaceSyncInputs.refreshRates,
      ),
    );
    await this.deps.userFeedRepository.syncWorkspaceRefreshRates(
      workspaceSyncInputs.refreshRates,
    );
    await this.deps.userFeedRepository.syncWorkspaceMaxDailyArticles(
      workspaceSyncInputs.maxDailyArticles,
    );

    logger.info("Maintenance operations completed");
  }

  async handleRefreshRate(
    refreshRateSeconds: number,
    {
      urlsHandler,
    }: {
      urlsHandler: (data: Array<UrlBatchItem>) => Promise<void>;
    },
  ): Promise<void> {
    const urlsToDebug = await this.deps.userFeedRepository.findDebugFeedUrls();
    const slotWindow = this.calculateCurrentSlotWindow(refreshRateSeconds);

    let urlBatch: UrlBatchItem[] = [];

    for await (const {
      url,
    } of this.deps.userFeedRepository.iterateUrlsForRefreshRate(
      refreshRateSeconds,
      slotWindow,
    )) {
      if (!url) {
        continue;
      }

      if (urlsToDebug.has(url)) {
        logger.info(
          `DEBUG: Schedule handler pushing url ${url} for ${refreshRateSeconds}s refresh rate`,
        );
      }

      urlBatch.push({
        url,
        saveToObjectStorage: urlsToDebug.has(url),
      });

      if (urlBatch.length === 25) {
        await urlsHandler(urlBatch);
        urlBatch = [];
      }
    }

    for await (const {
      url,
      feedRequestLookupKey,
      workspaceId,
      users,
      workspaces,
    } of this.deps.userFeedRepository.iterateFeedsWithLookupKeysForRefreshRate(
      refreshRateSeconds,
      slotWindow,
    )) {
      const lookupDetails = getFeedRequestLookupDetails({
        feed: {
          url,
          feedRequestLookupKey,
        },
        credentials: pickFeedCredentialSource({
          feed: { workspaceId },
          user: { externalCredentials: users[0]?.externalCredentials },
          workspace: workspaces[0],
        }),
        decryptionKey: this.deps.config.BACKEND_API_ENCRYPTION_KEY_HEX,
        redditFeedBaseUrl:
          this.deps.config.BACKEND_API_REDDIT_AUTHENTICATED_FEED_BASE_URL,
      });

      if (!lookupDetails) {
        continue;
      }

      urlBatch.push({
        url: lookupDetails?.url || url,
        saveToObjectStorage: urlsToDebug.has(url),
        lookupKey: lookupDetails?.key,
        headers: lookupDetails?.headers,
      });

      if (urlBatch.length === 25) {
        await urlsHandler(urlBatch);
        urlBatch = [];
      }
    }

    if (urlBatch.length > 0) {
      await urlsHandler(urlBatch);
    }
  }

  async getValidDiscordUserSupporters(): Promise<
    Awaited<
      ReturnType<
        typeof this.deps.supportersService.getBenefitsOfAllDiscordUsers
      >
    >
  > {
    const allBenefits =
      await this.deps.supportersService.getBenefitsOfAllDiscordUsers();

    return allBenefits.filter(({ isSupporter }) => isSupporter);
  }

  async enforceUserFeedLimits(): Promise<void> {
    const benefits =
      await this.deps.supportersService.getBenefitsOfAllDiscordUsers();

    await this.deps.userFeedsService.enforceAllUserFeedLimits(
      benefits.map(({ discordUserId, maxUserFeeds, refreshRateSeconds }) => ({
        discordUserId,
        maxUserFeeds,
        refreshRateSeconds,
      })),
    );

    await this.deps.userFeedsService.enforceAllWorkspaceFeedLimits();
  }

  // Workspace benefits are resolved per workspace, then grouped by value so the
  // repo can sync each distinct rate/limit with one update.
  private async buildWorkspaceSyncInputs(): Promise<{
    refreshRates: WorkspaceRefreshRateSyncInput;
    maxDailyArticles: WorkspaceMaxDailyArticlesSyncInput;
  }> {
    const workspaceIds =
      await this.deps.userFeedRepository.getDistinctWorkspaceIdsWithFeeds();

    const workspaceIdsByRate = new Map<number, string[]>();
    const workspaceIdsByArticles = new Map<number, string[]>();

    await Promise.all(
      workspaceIds.map(async (workspaceId) => {
        const { refreshRateSeconds, maxDailyArticles } =
          await this.deps.supportersService.getWorkspaceBenefits(workspaceId);

        const byRate = workspaceIdsByRate.get(refreshRateSeconds);
        if (byRate) {
          byRate.push(workspaceId);
        } else {
          workspaceIdsByRate.set(refreshRateSeconds, [workspaceId]);
        }

        const byArticles = workspaceIdsByArticles.get(maxDailyArticles);
        if (byArticles) {
          byArticles.push(workspaceId);
        } else {
          workspaceIdsByArticles.set(maxDailyArticles, [workspaceId]);
        }
      }),
    );

    return {
      refreshRates: {
        workspaceLimits: Array.from(workspaceIdsByRate.entries()).map(
          ([refreshRateSeconds, ids]) => ({
            workspaceIds: ids,
            refreshRateSeconds,
          }),
        ),
      },
      maxDailyArticles: {
        workspaceLimits: Array.from(workspaceIdsByArticles.entries()).map(
          ([maxDailyArticles, ids]) => ({
            workspaceIds: ids,
            maxDailyArticles,
          }),
        ),
      },
    };
  }

  private buildRefreshRateSyncInput(
    benefits: Awaited<
      ReturnType<
        typeof this.deps.supportersService.getBenefitsOfAllDiscordUsers
      >
    >,
  ): RefreshRateSyncInput {
    const validSupporters = benefits.filter(({ isSupporter }) => isSupporter);

    const supportersByRate = new Map<number, string[]>();
    for (const s of validSupporters) {
      const existing = supportersByRate.get(s.refreshRateSeconds);
      if (existing) {
        existing.push(s.discordUserId);
      } else {
        supportersByRate.set(s.refreshRateSeconds, [s.discordUserId]);
      }
    }

    return {
      supporterLimits: Array.from(supportersByRate.entries()).map(
        ([refreshRateSeconds, discordUserIds]) => ({
          discordUserIds,
          refreshRateSeconds,
        }),
      ),
      defaultRefreshRateSeconds: this.defaultRefreshRateSeconds,
    };
  }

  private buildMaxDailyArticlesSyncInput(
    benefits: Awaited<
      ReturnType<
        typeof this.deps.supportersService.getBenefitsOfAllDiscordUsers
      >
    >,
  ): MaxDailyArticlesSyncInput {
    const validSupporters = benefits.filter(({ isSupporter }) => isSupporter);

    const supportersByArticles = new Map<number, string[]>();
    for (const s of validSupporters) {
      const existing = supportersByArticles.get(s.maxDailyArticles);
      if (existing) {
        existing.push(s.discordUserId);
      } else {
        supportersByArticles.set(s.maxDailyArticles, [s.discordUserId]);
      }
    }

    return {
      supporterLimits: Array.from(supportersByArticles.entries()).map(
        ([maxDailyArticles, discordUserIds]) => ({
          discordUserIds,
          maxDailyArticles,
        }),
      ),
      defaultMaxDailyArticles:
        this.deps.supportersService.maxDailyArticlesDefault,
    };
  }

  private async recalculateSlotOffsetsForChangedRates(
    input: RefreshRateSyncInput,
  ): Promise<void> {
    await this.recalculateSlotOffsets(
      this.deps.userFeedRepository.iterateFeedsForRefreshRateSync(input),
    );
  }

  private async recalculateSlotOffsets(
    feeds: AsyncIterable<
      FeedForSlotOffsetRecalculation & { newRefreshRateSeconds: number }
    >,
  ): Promise<void> {
    const BATCH_SIZE = 1000;
    let batch: Array<{ feedId: string; slotOffsetMs: number }> = [];

    for await (const feed of feeds) {
      const effectiveRate =
        feed.userRefreshRateSeconds ?? feed.newRefreshRateSeconds;
      batch.push({
        feedId: feed.id,
        slotOffsetMs: calculateSlotOffsetMs(feed.url, effectiveRate),
      });

      if (batch.length >= BATCH_SIZE) {
        await this.deps.userFeedRepository.bulkUpdateSlotOffsets(batch);
        batch = [];
      }
    }

    if (batch.length > 0) {
      await this.deps.userFeedRepository.bulkUpdateSlotOffsets(batch);
    }
  }

  private calculateCurrentSlotWindow(refreshRateSeconds: number): SlotWindow {
    const refreshRateMs = refreshRateSeconds * 1000;
    const nowMs = this.deps.now ? this.deps.now() : Date.now();
    const cyclePositionMs = nowMs % refreshRateMs;
    const windowEndMs = cyclePositionMs + SCHEDULER_WINDOW_SIZE_MS;

    return {
      windowStartMs: cyclePositionMs,
      windowEndMs,
      wrapsAroundInterval: windowEndMs > refreshRateMs,
      refreshRateMs,
    };
  }
}
