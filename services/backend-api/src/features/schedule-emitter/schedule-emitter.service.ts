import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import logger from '../../utils/logger';
import { FeedSchedulingService } from '../feeds/feed-scheduling.service';
import { SupportersService } from '../supporters/supporters.service';

interface ScheduleEvent {
  refreshRateSeconds: number;
}

@Injectable()
export class ScheduleEmitterService {
  queueRegion: string;
  queueUrl: string;
  queueEndpoint: string;
  sqsClient: SQSClient;
  timers = new Map<number, NodeJS.Timer>();

  constructor(
    private readonly configService: ConfigService,
    private readonly supportersService: SupportersService,
    private readonly feedSchedulingService: FeedSchedulingService,
  ) {
    this.queueRegion = configService.get('awsScheduleQueueRegion') as string;
    this.queueUrl = configService.get('awsScheduleQueueUrl') as string;
    this.queueEndpoint = configService.get(
      'awsScheduleQueueEndpoint',
    ) as string;

    this.sqsClient = new SQSClient({
      region: this.queueRegion,
      endpoint: this.queueEndpoint,
      credentials: {
        accessKeyId: configService.get('awsAccessKeyId') as string,
        secretAccessKey: configService.get('awsSecretAccessKey') as string,
      }
    });
  }

  async emitScheduleEvent(scheduleEvent: ScheduleEvent) {
    await this.sqsClient.send(
      new SendMessageCommand({
        MessageBody: JSON.stringify(scheduleEvent),
        QueueUrl: this.queueUrl,
      }),
    );
  }

  async syncTimerStates(
    onTimerTrigger: (refreshRateSeconds: number) => Promise<void>,
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
      allBenefits.map((benefit) => benefit.refreshRateSeconds * 1000),
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
      'defaultRefreshRateMinutes',
    );

    if (refreshRateMinutes === undefined) {
      throw new Error('defaultRefreshRateMinutes is not defined in the config');
    }

    return refreshRateMinutes * 60 * 1000;
  }

  cleanupTimers(
    inputTimers: Map<number, NodeJS.Timer>,
    refreshRates: Set<number>,
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
        (refreshRate) => `${refreshRate / 1000}s`,
      )}]`,
    );
  }

  setNewTimers(
    inputTimers: Map<number, NodeJS.Timer>,
    refreshRates: Set<number>,
    onTimerTrigger: (refreshRateSeconds: number) => Promise<void>,
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
        (refreshRate) => `${refreshRate / 1000}s`,
      )}]`,
    );
  }
}
