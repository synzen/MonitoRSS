import { INestApplicationContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { FeedSchedulingService } from '../features/feeds/feed-scheduling.service';
import { SupportersService } from '../features/supporters/supporters.service';
import logger from '../utils/logger';

const timers = new Map<number, NodeJS.Timer>();

bootstrap();

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule.forRoot());
  // application logic...
  await app.init();

  await checkTimers(app);
  setInterval(async () => {
    try {
      logger.info(`Checking timers....`);
      await checkTimers(app);
    } catch (err) {
      logger.error(`Failed to check timers`, {
        stack: err.stack,
      });
    }
  }, 1000 * 60);
}

async function checkTimers(app: INestApplicationContext) {
  const supporterRefreshRates = await getSupporterRefreshRates(app);
  logger.info(`Supporter refresh rates: [${supporterRefreshRates}]`);

  const scheduleRefreshRates = await getScheduleRefreshRates(app);
  logger.info(`Schedule refresh rates: [${scheduleRefreshRates}]`);

  const defaultRefreshRate = await getDefaultRefreshRate(app);
  logger.info(`Default refresh rate: [${defaultRefreshRate}]`);

  const setOfRefreshRatesMs = new Set([
    ...supporterRefreshRates,
    ...scheduleRefreshRates,
    defaultRefreshRate,
  ]);

  cleanupTimers(timers, setOfRefreshRatesMs);
  setNewTimers(timers, setOfRefreshRatesMs);
}

async function getSupporterRefreshRates(app: INestApplicationContext) {
  const supportersService = app.get(SupportersService);
  const allBenefits = await supportersService.getBenefitsOfAllServers();
  const supporterRefreshRates = new Set(
    allBenefits.map((benefit) => benefit.refreshRateSeconds * 1000),
  );

  return [...supporterRefreshRates];
}

async function getScheduleRefreshRates(app: INestApplicationContext) {
  const schedulingService = app.get(FeedSchedulingService);
  const allSchedules = await schedulingService.getAllSchedules();

  const scheduleRefreshRates = allSchedules.map((schedule) => {
    return schedule.refreshRateMinutes * 60 * 1000;
  });

  return scheduleRefreshRates;
}

async function getDefaultRefreshRate(app: INestApplicationContext) {
  const configService = app.get(ConfigService);
  const refreshRateMinutes = configService.get<number>(
    'defaultRefreshRateMinutes',
  );

  if (refreshRateMinutes === undefined) {
    throw new Error('defaultRefreshRateMinutes is not defined in the config');
  }

  return refreshRateMinutes * 60 * 1000;
}

function cleanupTimers(
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

function setNewTimers(
  inputTimers: Map<number, NodeJS.Timer>,
  refreshRates: Set<number>,
) {
  const timersSet: number[] = [];

  refreshRates.forEach((refreshRate) => {
    if (inputTimers.has(refreshRate)) {
      return;
    }

    timersSet.push(refreshRate);
    const timer = setInterval(() => {
      logger.info(`Refreshing at ${refreshRate / 1000}s`);
    }, refreshRate);
    inputTimers.set(refreshRate, timer);
  });

  logger.info(
    `Set ${timersSet.length} timers: [${timersSet.map(
      (refreshRate) => `${refreshRate / 1000}s`,
    )}]`,
  );
}
