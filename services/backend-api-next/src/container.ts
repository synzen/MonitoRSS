import type { Connection as MongoConnection } from "mongoose";
import type { Connection as RabbitConnection } from "rabbitmq-client";
import type { Config } from "./config";
import { createAuthService, type AuthService } from "./infra/auth";
import { createPublisher } from "./infra/rabbitmq";
import {
  MongoMigrationMongooseRepository,
  FailRecordMongooseRepository,
  BannedFeedMongooseRepository,
  FeedScheduleMongooseRepository,
  DiscordServerProfileMongooseRepository,
  UserFeedLimitOverrideMongooseRepository,
  PatronMongooseRepository,
  NotificationDeliveryAttemptMongooseRepository,
  LegacyFeedConversionJobMongooseRepository,
  FeedSubscriberMongooseRepository,
  UserMongooseRepository,
  CustomerMongooseRepository,
  FeedMongooseRepository,
  FeedFilteredFormatMongooseRepository,
  SupporterMongooseRepository,
  UserFeedMongooseRepository,
  UserFeedTagMongooseRepository,
} from "./repositories/mongoose";
import { DiscordApiService } from "./services/discord-api/discord-api.service";
import { FeedFetcherApiService } from "./services/feed-fetcher-api/feed-fetcher-api.service";
import { FeedHandlerService } from "./services/feed-handler/feed-handler.service";
import { PaddleService } from "./services/paddle/paddle.service";
import { RedditApiService } from "./services/reddit-api/reddit-api.service";

export interface Container {
  config: Config;
  mongoConnection: MongoConnection;
  rabbitmq: RabbitConnection;
  authService: AuthService;
  publishMessage: (queue: string, message: unknown) => Promise<void>;

  // Repositories
  mongoMigrationRepository: MongoMigrationMongooseRepository;
  failRecordRepository: FailRecordMongooseRepository;
  bannedFeedRepository: BannedFeedMongooseRepository;
  feedScheduleRepository: FeedScheduleMongooseRepository;
  discordServerProfileRepository: DiscordServerProfileMongooseRepository;
  userFeedLimitOverrideRepository: UserFeedLimitOverrideMongooseRepository;
  patronRepository: PatronMongooseRepository;
  notificationDeliveryAttemptRepository: NotificationDeliveryAttemptMongooseRepository;
  legacyFeedConversionJobRepository: LegacyFeedConversionJobMongooseRepository;
  feedSubscriberRepository: FeedSubscriberMongooseRepository;
  userRepository: UserMongooseRepository;
  customerRepository: CustomerMongooseRepository;
  feedRepository: FeedMongooseRepository;
  feedFilteredFormatRepository: FeedFilteredFormatMongooseRepository;
  supporterRepository: SupporterMongooseRepository;
  userFeedRepository: UserFeedMongooseRepository;
  userFeedTagRepository: UserFeedTagMongooseRepository;

  // External API Services
  discordApiService: DiscordApiService;
  feedFetcherApiService: FeedFetcherApiService;
  feedHandlerService: FeedHandlerService;
  paddleService: PaddleService;
  redditApiService: RedditApiService;
}

export function createContainer(deps: {
  config: Config;
  mongoConnection: MongoConnection;
  rabbitmq: RabbitConnection;
}): Container {
  const authService = createAuthService(deps.config);
  const publishMessage = createPublisher(deps.rabbitmq);

  return {
    config: deps.config,
    mongoConnection: deps.mongoConnection,
    rabbitmq: deps.rabbitmq,
    authService,
    publishMessage,

    // Repositories
    mongoMigrationRepository: new MongoMigrationMongooseRepository(deps.mongoConnection),
    failRecordRepository: new FailRecordMongooseRepository(deps.mongoConnection),
    bannedFeedRepository: new BannedFeedMongooseRepository(deps.mongoConnection),
    feedScheduleRepository: new FeedScheduleMongooseRepository(deps.mongoConnection),
    discordServerProfileRepository: new DiscordServerProfileMongooseRepository(deps.mongoConnection),
    userFeedLimitOverrideRepository: new UserFeedLimitOverrideMongooseRepository(deps.mongoConnection),
    patronRepository: new PatronMongooseRepository(deps.mongoConnection),
    notificationDeliveryAttemptRepository: new NotificationDeliveryAttemptMongooseRepository(deps.mongoConnection),
    legacyFeedConversionJobRepository: new LegacyFeedConversionJobMongooseRepository(deps.mongoConnection),
    feedSubscriberRepository: new FeedSubscriberMongooseRepository(deps.mongoConnection),
    userRepository: new UserMongooseRepository(deps.mongoConnection),
    customerRepository: new CustomerMongooseRepository(deps.mongoConnection),
    feedRepository: new FeedMongooseRepository(deps.mongoConnection),
    feedFilteredFormatRepository: new FeedFilteredFormatMongooseRepository(deps.mongoConnection),
    supporterRepository: new SupporterMongooseRepository(deps.mongoConnection),
    userFeedRepository: new UserFeedMongooseRepository(deps.mongoConnection),
    userFeedTagRepository: new UserFeedTagMongooseRepository(deps.mongoConnection),

    // External API Services
    discordApiService: new DiscordApiService(deps.config),
    feedFetcherApiService: new FeedFetcherApiService(deps.config),
    feedHandlerService: new FeedHandlerService(deps.config),
    paddleService: new PaddleService(deps.config),
    redditApiService: new RedditApiService(deps.config),
  };
}
