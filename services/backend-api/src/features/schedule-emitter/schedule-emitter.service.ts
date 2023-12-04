import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import logger from "../../utils/logger";
import { SupportersService } from "../supporters/supporters.service";

@Injectable()
export class ScheduleEmitterService {
  timers = new Map<number, NodeJS.Timer>();

  constructor(
    private readonly configService: ConfigService,
    private readonly supportersService: SupportersService
  ) {}

  async syncTimerStates(
    onTimerTrigger: (refreshRateSeconds: number) => Promise<void>
  ) {
    const supporterRefreshRates = await this.getSupporterRefreshRates();
    logger.debug(`Supporter refresh rates: [${supporterRefreshRates}]`);

    const defaultRefreshRate = await this.getDefaultRefreshRate();
    logger.debug(`Default refresh rate: [${defaultRefreshRate}]`);

    const setOfRefreshRatesMs = new Set([
      ...supporterRefreshRates,
      defaultRefreshRate,
    ]);

    this.cleanupTimers(this.timers, setOfRefreshRatesMs);
    this.setNewTimers(this.timers, setOfRefreshRatesMs, onTimerTrigger);
  }

  async getSupporterRefreshRates() {
    const allBenefits =
      await this.supportersService.getBenefitsOfAllDiscordUsers();
    const supporterRefreshRates = new Set(
      allBenefits.map((benefit) => benefit.refreshRateSeconds * 1000)
    );

    return [...supporterRefreshRates];
  }

  getDefaultRefreshRate() {
    const refreshRateMinutes = this.configService.get<number>(
      "BACKEND_API_DEFAULT_REFRESH_RATE_MINUTES"
    );

    if (refreshRateMinutes === undefined) {
      throw new Error(
        "BACKEND_API_DEFAULT_REFRESH_RATE_MINUTES is not defined in the config"
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

    logger.debug(
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
      onTimerTrigger(refreshRate / 1000);
    });

    logger.debug(
      `Set ${timersSet.length} timers: [${timersSet.map(
        (refreshRate) => `${refreshRate / 1000}s`
      )}]`
    );
  }
}
