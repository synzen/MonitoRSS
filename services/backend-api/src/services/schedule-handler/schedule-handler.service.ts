import type { UrlFetchTrigger } from "@monitorss/contracts";
import type { Config } from "../../config";
import type { SupportersService } from "../supporters/supporters.service";
import type { UserFeedsService } from "../user-feeds/user-feeds.service";
import type { UsersService } from "../users/users.service";
import type { MessageBrokerService } from "../message-broker/message-broker.service";
import type { FeedFetcherApiService } from "../feed-fetcher-api/feed-fetcher-api.service";
import type {
  IUserFeedRepository,
  RefreshRateSyncInput,
  MaxDailyArticlesSyncInput,
  WorkspaceRefreshRateSyncInput,
  WorkspaceMaxDailyArticlesSyncInput,
  FeedForSlotOffsetRecalculation,
  ScheduledFeedForClockScheduling,
} from "../../repositories/interfaces/user-feed.types";
import type { SlotWindow } from "../../shared/types/slot-window.types";
import type { BulkRetryableFeed } from "../../repositories/interfaces/user-feed.types";
import {
  SCHEDULED_BATCH_RATE_SECONDS,
  SCHEDULER_WINDOW_SIZE_MS,
} from "../../shared/constants/scheduler.constants";
import { selectDueScheduledFeeds } from "../../shared/utils/scheduled-feed-computation";
import { calculateSlotOffsetMs } from "../../shared/utils/fnv1a-hash";
import logger from "../../infra/logger";

export interface ScheduleHandlerServiceDeps {
  config: Config;
  supportersService: SupportersService;
  userFeedsService: UserFeedsService;
  usersService: UsersService;
  userFeedRepository: IUserFeedRepository;
  messageBrokerService: MessageBrokerService;
  feedFetcherApiService: FeedFetcherApiService;
  now?: () => number;
}

interface UrlBatchItem {
  url: string;
  saveToObjectStorage?: boolean;
  lookupKey?: string;
  headers?: Record<string, string>;
  // Marks a bulk-retry fetch; see the url.fetch-batch contract (ADR-011) for
  // what the consumer bypasses.
  force?: boolean;
  // Request metadata for clock-scheduled fetches (ADR-009): the batch entry is
  // stamped with the occurrence it fulfills and copied through to the
  // completed event. Interval fetches carry no trigger.
  trigger?: UrlFetchTrigger;
}

const URL_BATCH_SIZE = 25;

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

    await this.syncActiveFeedUrls();

    logger.info("Maintenance operations completed");
  }

  /**
   * Platform-provider GC sweep: tells feed-requests which URLs still have an
   * actively-fetching feed so it can release vendor resources nobody uses.
   * Failures only cost a cycle — the next sweep re-syncs the full set.
   */
  private async syncActiveFeedUrls(): Promise<void> {
    if (!this.deps.config.BACKEND_API_PLATFORM_FEED_URL_SYNC_ENABLED) {
      return;
    }

    try {
      const urls =
        await this.deps.userFeedRepository.getDistinctActiveFeedUrls();

      await this.deps.feedFetcherApiService.syncActiveFeedUrls(urls);
    } catch (err) {
      logger.warn("Failed to sync active feed urls for platform GC sweep", {
        error: (err as Error).stack,
      });
    }
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

    for await (const { url } of this.deps.userFeedRepository.iterateUrlsForRefreshRate(
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

      if (urlBatch.length === URL_BATCH_SIZE) {
        await urlsHandler(urlBatch);
        urlBatch = [];
      }
    }

    for await (const {
      url,
      feedRequestLookupKey,
    } of this.deps.userFeedRepository.iterateFeedsWithLookupKeysForRefreshRate(
      refreshRateSeconds,
      slotWindow,
    )) {
      urlBatch.push(
        this.resolveLookupKeyBatchItem({
          url,
          feedRequestLookupKey,
          saveToObjectStorage: urlsToDebug.has(url),
        }),
      );

      if (urlBatch.length === URL_BATCH_SIZE) {
        await urlsHandler(urlBatch);
        urlBatch = [];
      }
    }

    if (urlBatch.length > 0) {
      await urlsHandler(urlBatch);
    }
  }

  /**
   * Clock branch of the scheduler loop (ADR-009): fires each scheduled-mode
   * feed once per scheduled local minute, at the URL's hash-derived delay slot
   * within the jitter window after that minute. Due feeds are selected by the
   * pure scheduled-feed-computation (timezone wall clock, catch-up bound,
   * once-per-scheduled-time guard input, hot-minute spreading), grouped by URL
   * into the same batch shape as the interval path, and stamped with a
   * scheduled trigger carrying the scheduled time.
   */
  async handleScheduledFeeds(): Promise<void> {
    const nowMs = this.deps.now ? this.deps.now() : Date.now();
    const urlsToDebug = await this.deps.userFeedRepository.findDebugFeedUrls();

    const scheduledFeeds: ScheduledFeedForClockScheduling[] = [];

    for await (const feed of this.deps.userFeedRepository.iterateScheduledFeedsForClockScheduling()) {
      scheduledFeeds.push(feed);
    }

    const dueFeeds = selectDueScheduledFeeds(scheduledFeeds, nowMs);

    if (dueFeeds.length === 0) {
      return;
    }

    const batchItems: UrlBatchItem[] = [];
    // Plain feeds sharing a URL and scheduled time collapse into one entry;
    // the fetch is the batching unit, not the feed.
    const entriesByUrl = new Map<string, UrlBatchItem>();

    for (const { feed, scheduledAt } of dueFeeds) {
      if (feed.feedRequestLookupKey) {
        batchItems.push(
          this.resolveLookupKeyBatchItem({
            url: feed.url,
            feedRequestLookupKey: feed.feedRequestLookupKey,
            saveToObjectStorage: urlsToDebug.has(feed.url),
            trigger: { kind: "scheduled", occurredAt: scheduledAt },
          }),
        );

        continue;
      }

      const mapKey = `${feed.url}|${scheduledAt}`;

      if (!entriesByUrl.has(mapKey)) {
        entriesByUrl.set(mapKey, {
          url: feed.url,
          saveToObjectStorage: urlsToDebug.has(feed.url),
          trigger: { kind: "scheduled", occurredAt: scheduledAt },
        });
      }
    }

    batchItems.push(...entriesByUrl.values());

    for (let i = 0; i < batchItems.length; i += URL_BATCH_SIZE) {
      await this.emitUrlRequestBatchEvent({
        rateSeconds: SCHEDULED_BATCH_RATE_SECONDS,
        data: batchItems.slice(i, i + URL_BATCH_SIZE),
      });
    }
  }

  // Lookup keys previously selected credential-transformed oauth.reddit.com
  // fetch urls; reddit credentials no longer affect fetching (reddit's RSS is
  // gone and platform feeds fetch through provider adapters), so a lookup-key
  // feed fetches its raw URL with its stored key for request-row identity.
  private resolveLookupKeyBatchItem(input: {
    url: string;
    // Legacy rows can carry null instead of undefined for a missing key.
    feedRequestLookupKey?: string | null;
    saveToObjectStorage: boolean;
    force?: boolean;
    trigger?: UrlFetchTrigger;
  }): UrlBatchItem {
    return {
      url: input.url,
      lookupKey: input.feedRequestLookupKey ?? undefined,
      saveToObjectStorage: input.saveToObjectStorage,
      ...(input.force ? { force: true } : {}),
      ...(input.trigger ? { trigger: input.trigger } : {}),
    };
  }

  /**
   * Publishes forced (bulk-retry) fetch batches for expired feeds (ADR-011):
   * lookup-key feeds carry their stored lookup key for row identity,
   * duplicate URLs collapse to one entry, and each refresh rate gets its own
   * batch so the request worker's per-rate lock scoping stays intact.
   */
  async emitForcedFetchBatches(
    workspaceId: string,
    feeds: BulkRetryableFeed[],
  ): Promise<number> {
    const resolved = new Map<
      string,
      { url: string; lookupKey?: string; rateSeconds: number }
    >();

    for (const feed of feeds) {
      const item: UrlBatchItem = this.resolveLookupKeyBatchItem({
        url: feed.url,
        feedRequestLookupKey: feed.feedRequestLookupKey,
        saveToObjectStorage: false,
        force: true,
      });

      const key = `${item.url}|${item.lookupKey ?? ""}`;

      if (!resolved.has(key)) {
        resolved.set(key, {
          url: item.url,
          lookupKey: item.lookupKey,
          // Legacy rows can lack the field; the schema default never backfilled.
          rateSeconds: feed.refreshRateSeconds ?? this.defaultRefreshRateSeconds,
        });
      }
    }

    const byRate = new Map<
      number,
      Array<{ url: string; lookupKey?: string; force: true }>
    >();

    for (const entry of resolved.values()) {
      const batch = byRate.get(entry.rateSeconds) ?? [];

      batch.push({
        url: entry.url,
        ...(entry.lookupKey ? { lookupKey: entry.lookupKey } : {}),
        force: true,
      });
      byRate.set(entry.rateSeconds, batch);
    }

    for (const [rateSeconds, data] of byRate) {
      await this.emitUrlRequestBatchEvent({ rateSeconds, data });
    }

    return resolved.size;
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
        premiumFloorSeconds:
          this.deps.config.BACKEND_API_PREMIUM_FEEDS_MIN_REFRESH_RATE_SECONDS,
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
      premiumFloorSeconds:
        this.deps.config.BACKEND_API_PREMIUM_FEEDS_MIN_REFRESH_RATE_SECONDS,
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
