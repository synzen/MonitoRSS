import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectModel } from "@nestjs/mongoose";
import logger, { ENABLE_DEBUG_LOGS } from "../../utils/logger";
import { SupportersService } from "../supporters/supporters.service";
import { UserFeed, UserFeedModel } from "../user-feeds/entities";

@Injectable()
export class ScheduleEmitterService {
  /**
   * Tracks which refresh rates are currently active (have feeds using them).
   * Used to detect when refresh rates are added or removed.
   */
  activeRefreshRates = new Set<number>();

  constructor(
    private readonly configService: ConfigService,
    private readonly supportersService: SupportersService,
    @InjectModel(UserFeed.name) private readonly userFeedModel: UserFeedModel
  ) {}

  /**
   * Called every 30 seconds to trigger feed fetching for all refresh rates.
   *
   * With slot-based staggering, we must call onTimerTrigger for EVERY refresh
   * rate on EVERY 30-second tick. The slot window filtering in the query
   * ensures only feeds due in the current 30-second window are fetched.
   */
  async syncTimerStates(
    onTimerTrigger: (refreshRateSeconds: number) => Promise<void>
  ) {
    const [allRefreshRatesSeconds, allUserRefreshRateSeconds] =
      await Promise.all([
        this.userFeedModel.distinct("refreshRateSeconds").exec(),
        this.userFeedModel.distinct("userRefreshRateSeconds").exec(),
      ]);

    if (ENABLE_DEBUG_LOGS) {
      const totalFeeds = await this.userFeedModel.countDocuments().exec();

      logger.debug(
        `Extracting refresh rates from ${totalFeeds} feeds to sync timer states`
      );
    }

    const currentRefreshRatesMs = new Set([
      ...allRefreshRatesSeconds
        .concat(allUserRefreshRateSeconds)
        .filter((s) => !!s)
        .map((seconds) => seconds * 1000),
    ]);

    this.logRefreshRateChanges(currentRefreshRatesMs);
    this.activeRefreshRates = currentRefreshRatesMs;

    // Trigger all refresh rates on every 30-second tick
    // The slot window query will filter to only feeds due now
    await this.triggerAllRefreshRates(currentRefreshRatesMs, onTimerTrigger);
  }

  private logRefreshRateChanges(currentRefreshRatesMs: Set<number>) {
    const added = [...currentRefreshRatesMs].filter(
      (r) => !this.activeRefreshRates.has(r)
    );
    const removed = [...this.activeRefreshRates].filter(
      (r) => !currentRefreshRatesMs.has(r)
    );

    if (added.length > 0) {
      logger.info(
        `New refresh rates detected: [${added
          .map((r) => `${r / 1000}s`)
          .join(", ")}]`
      );
    }

    if (removed.length > 0) {
      logger.info(
        `Refresh rates removed: [${removed
          .map((r) => `${r / 1000}s`)
          .join(", ")}]`
      );
    }

    logger.debug(
      `Active refresh rates (${currentRefreshRatesMs.size}): ${Array.from(
        currentRefreshRatesMs
      )
        .map((r) => `${r / 1000}s`)
        .join(", ")}`
    );
  }

  private async triggerAllRefreshRates(
    refreshRatesMs: Set<number>,
    onTimerTrigger: (refreshRateSeconds: number) => Promise<void>
  ) {
    const triggerPromises = Array.from(refreshRatesMs).map(
      async (refreshRateMs) => {
        try {
          await onTimerTrigger(refreshRateMs / 1000);
        } catch (err) {
          logger.error(
            `Failed to trigger refresh rate ${refreshRateMs / 1000}s`,
            {
              stack: (err as Error).stack,
            }
          );
        }
      }
    );

    await Promise.all(triggerPromises);
  }
}
