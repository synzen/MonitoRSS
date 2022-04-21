import { INestApplicationContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { AppModule } from '../app.module';
import { FeedSchedule } from '../features/feeds/entities/feed-schedule.entity';
import {
  Feed,
  FeedDocument,
  FeedModel,
} from '../features/feeds/entities/feed.entity';
import { FeedSchedulingService } from '../features/feeds/feed-scheduling.service';
import { SupportersService } from '../features/supporters/supporters.service';
import { Types, FilterQuery } from 'mongoose';

bootstrap();

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule.forRoot());
  // application logic...
  await app.init();

  getUrlsMatchingRefreshRate(app, 600);
}

async function getUrlsMatchingRefreshRate(
  app: INestApplicationContext,
  refreshRateSeconds: number,
) {
  const configService = app.get(ConfigService);
  const defaultRefreshRateSeconds =
    (configService.get<number>('defaultRefreshRateMinutes') as number) * 60;
  const isDefaultRefreshRate = refreshRateSeconds === defaultRefreshRateSeconds;

  const schedules = await getSchedulesOfRefreshRate(app, refreshRateSeconds);
  const serverIds = await getServerIdsWithRefreshRate(app, refreshRateSeconds);

  if (isDefaultRefreshRate) {
    return getDefaultFeedUrls(app, schedules, serverIds);
  }

  return getFeedUrlsWithScheduleAndServers(app, schedules, serverIds);
}

async function getServerIdsWithRefreshRate(
  app: INestApplicationContext,
  refreshRateSeconds: number,
) {
  const supportersService = app.get(SupportersService);
  const allBenefits = await supportersService.getBenefitsOfAllServers();
  const benefitsWithMatchedRefreshRate = allBenefits.filter(
    (benefit) => benefit.refreshRateSeconds === refreshRateSeconds,
  );

  return benefitsWithMatchedRefreshRate.map((benefit) => benefit.serverId);
}

async function getSchedulesOfRefreshRate(
  app: INestApplicationContext,
  refreshRateSeconds: number,
) {
  const schedulingService = app.get(FeedSchedulingService);

  return schedulingService.findSchedulesOfRefreshRate(refreshRateSeconds);
}

export function getFeedUrlsWithScheduleAndServers(
  app: INestApplicationContext,
  schedules: FeedSchedule[],
  serverIds: string[],
  options?: {
    invertQuery: boolean;
  },
) {
  const feedModel = app.get<FeedModel>(getModelToken(Feed.name));

  const keywordConditions = schedules
    .map((schedule) => schedule.keywords)
    .flat()
    .map((keyword) => ({
      url: new RegExp(keyword, 'i'),
    }));

  let query: FilterQuery<FeedDocument> = {
    $or: [
      ...keywordConditions,
      {
        guild: { $in: serverIds },
      },
      {
        _id: {
          $in: schedules
            .map((schedule) =>
              schedule.feeds.map((id) => new Types.ObjectId(id)),
            )
            .flat(),
        },
      },
    ],
  };

  if (options?.invertQuery) {
    query = {
      $not: query,
    };
  }

  return feedModel.find(query).distinct('url');
}

export function getDefaultFeedUrls(
  app: INestApplicationContext,
  schedules: FeedSchedule[],
  serverIds: string[],
) {
  const feedModel = app.get<FeedModel>(getModelToken(Feed.name));

  const keywordConditions = schedules
    .map((schedule) => schedule.keywords)
    .flat()
    .map((keyword) => ({
      url: {
        $not: new RegExp(keyword, 'i'),
      },
    }));

  const query: FilterQuery<FeedDocument> = {
    $and: [
      ...keywordConditions,
      {
        guild: { $nin: serverIds },
      },
      {
        _id: {
          $nin: schedules
            .map((schedule) =>
              schedule.feeds.map((id) => new Types.ObjectId(id)),
            )
            .flat(),
        },
      },
    ],
  };

  return feedModel.find(query).distinct('url');
}
