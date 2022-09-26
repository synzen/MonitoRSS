import { SQSClient } from "@aws-sdk/client-sqs";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import logger from "../../utils/logger";
import { FeedSchedulingService } from "../feeds/feed-scheduling.service";
import { SupportersService } from "../supporters/supporters.service";

@Injectable()
export class ScheduleEmitterService {
  sqsClient: SQSClient;
  timers = new Map<number, NodeJS.Timer>();

  constructor(
    private readonly configService: ConfigService,
    private readonly supportersService: SupportersService,
    private readonly feedSchedulingService: FeedSchedulingService
  ) {}

  async syncTimerStates(
    onTimerTrigger: (refreshRateSeconds: number) => Promise<void>
  ) {
    const supporterRefreshRates = await this.getSupporterRefreshRates();
    logger.info(`Supporter refresh rates: [${supporterRefreshRates}]`);

    const scheduleRefreshRates = await this.getScheduleRefreshRates();
    logger.info(`Schedule refresh rates: [${scheduleRefreshRates}]`);

    const defaultRefreshRate = await this.getDefaultRefreshRate();
    logger.info(`Default refresh rate: [${defaultRefreshRate}]`);

    const setOfRefreshRatesMs = new Set([
      ...supporterRefreshRates,
      ...scheduleRefreshRates,
      defaultRefreshRate,
    ]);

    this.cleanupTimers(this.timers, setOfRefreshRatesMs);
    this.setNewTimers(this.timers, setOfRefreshRatesMs, onTimerTrigger);
  }

  async getSupporterRefreshRates() {
    const allBenefits = await this.supportersService.getBenefitsOfAllServers();
    const supporterRefreshRates = new Set(
      allBenefits.map((benefit) => benefit.refreshRateSeconds * 1000)
    );

    return [...supporterRefreshRates];
  }

  async getScheduleRefreshRates() {
    const allSchedules = await this.feedSchedulingService.getAllSchedules();

    const scheduleRefreshRates = allSchedules.map((schedule) => {
      return schedule.refreshRateMinutes * 60 * 1000;
    });

    return scheduleRefreshRates;
  }

  getDefaultRefreshRate() {
    const refreshRateMinutes = this.configService.get<number>(
      "DEFAULT_REFRESH_RATE_MINUTES"
    );

    if (refreshRateMinutes === undefined) {
      throw new Error(
        "DEFAULT_REFRESH_RATE_MINUTES is not defined in the config"
      );
    }

    return refreshRateMinutes * 60 * 1000;
  }

  cleanupTimers(
    inputTimers: Map<number, NodeJS.Timer>,
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

    logger.info(
      `Removed ${timersRemoved.length} timers: [${timersRemoved.map(
        (refreshRate) => `${refreshRate / 1000}s`
      )}]`
    );
  }

  setNewTimers(
    inputTimers: Map<number, NodeJS.Timer>,
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
    });

    logger.info(
      `Set ${timersSet.length} timers: [${timersSet.map(
        (refreshRate) => `${refreshRate / 1000}s`
      )}]`
    );
  }
}
