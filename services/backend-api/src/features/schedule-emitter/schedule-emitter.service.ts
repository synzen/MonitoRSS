import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectModel } from "@nestjs/mongoose";
import logger, { ENABLE_DEBUG_LOGS } from "../../utils/logger";
import { SupportersService } from "../supporters/supporters.service";
import { UserFeed, UserFeedModel } from "../user-feeds/entities";

@Injectable()
export class ScheduleEmitterService {
  timers = new Map<number, NodeJS.Timeout>();

  constructor(
    private readonly configService: ConfigService,
    private readonly supportersService: SupportersService,
    @InjectModel(UserFeed.name) private readonly userFeedModel: UserFeedModel
  ) {}

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

    const setOfRefreshRatesMs = new Set([
      ...allRefreshRatesSeconds
        .concat(allUserRefreshRateSeconds)
        .filter((s) => !!s)
        .map((seconds) => seconds * 1000),
    ]);

    logger.info(
      `Found ${setOfRefreshRatesMs.size} unique refresh rates: ${Array.from(
        setOfRefreshRatesMs
      ).join(",")}`
    );

    this.cleanupTimers(this.timers, setOfRefreshRatesMs);
    this.setNewTimers(this.timers, setOfRefreshRatesMs, onTimerTrigger);
  }

  cleanupTimers(
    inputTimers: Map<number, NodeJS.Timeout>,
    refreshRates: Set<number>
  ) {
    const timersRemoved: number[] = [];
    inputTimers.forEach((timer, key) => {
      if (refreshRates.has(key)) {
        return;
      }

      timersRemoved.push(key);
      clearInterval(timer);
      inputTimers.delete(key);
    });

    logger.debug(
      `Removed ${timersRemoved.length} timers: [${timersRemoved.map(
        (refreshRate) => `${refreshRate / 1000}s`
      )}]`
    );
  }

  setNewTimers(
    inputTimers: Map<number, NodeJS.Timeout>,
    refreshRates: Set<number>,
    onTimerTrigger: (refreshRateSeconds: number) => Promise<void>
  ) {
    const timersSet: number[] = [];

    refreshRates.forEach((refreshRate) => {
      if (inputTimers.has(refreshRate)) {
        return;
      }

      timersSet.push(refreshRate);
      const timer = setInterval(async () => {
        await onTimerTrigger(refreshRate / 1000);
      }, refreshRate);
      inputTimers.set(refreshRate, timer);
      onTimerTrigger(refreshRate / 1000);
    });

    logger.debug(
      `Set ${timersSet.length} timers: [${timersSet.map(
        (refreshRate) => `${refreshRate / 1000}s`
      )}]`
    );
  }
}
