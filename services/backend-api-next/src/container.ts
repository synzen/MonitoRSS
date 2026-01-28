import type { Connection as MongoConnection } from "mongoose";
import type { Connection as RabbitConnection } from "rabbitmq-client";
import type { Config } from "./config";
import { createAuthService, type AuthService } from "./infra/auth";
import { createPublisher } from "./infra/rabbitmq";
import type { IMongoMigrationRepository } from "./repositories/interfaces/mongo-migration.types";
import type { IFailRecordRepository } from "./repositories/interfaces/fail-record.types";
import type { IBannedFeedRepository } from "./repositories/interfaces/banned-feed.types";
import type { IFeedScheduleRepository } from "./repositories/interfaces/feed-schedule.types";
import type { IDiscordServerProfileRepository } from "./repositories/interfaces/discord-server-profile.types";
import type { IUserFeedLimitOverrideRepository } from "./repositories/interfaces/user-feed-limit-override.types";
import type { IPatronRepository } from "./repositories/interfaces/patron.types";
import type { INotificationDeliveryAttemptRepository } from "./repositories/interfaces/notification-delivery-attempt.types";
import type { IFeedSubscriberRepository } from "./repositories/interfaces/feed-subscriber.types";
import type { IUserRepository } from "./repositories/interfaces/user.types";
import type { ICustomerRepository } from "./repositories/interfaces/customer.types";
import type { IFeedRepository } from "./repositories/interfaces/feed.types";
import type { IFeedFilteredFormatRepository } from "./repositories/interfaces/feed-filtered-format.types";
import type { ISupporterRepository } from "./repositories/interfaces/supporter.types";
import type { IUserFeedRepository } from "./repositories/interfaces/user-feed.types";
import { MongoMigrationMongooseRepository } from "./repositories/mongoose/mongo-migration.mongoose.repository";
import { FailRecordMongooseRepository } from "./repositories/mongoose/fail-record.mongoose.repository";
import { BannedFeedMongooseRepository } from "./repositories/mongoose/banned-feed.mongoose.repository";
import { FeedScheduleMongooseRepository } from "./repositories/mongoose/feed-schedule.mongoose.repository";
import { DiscordServerProfileMongooseRepository } from "./repositories/mongoose/discord-server-profile.mongoose.repository";
import { UserFeedLimitOverrideMongooseRepository } from "./repositories/mongoose/user-feed-limit-override.mongoose.repository";
import { PatronMongooseRepository } from "./repositories/mongoose/patron.mongoose.repository";
import { NotificationDeliveryAttemptMongooseRepository } from "./repositories/mongoose/notification-delivery-attempt.mongoose.repository";
import { FeedSubscriberMongooseRepository } from "./repositories/mongoose/feed-subscriber.mongoose.repository";
import { UserMongooseRepository } from "./repositories/mongoose/user.mongoose.repository";
import { CustomerMongooseRepository } from "./repositories/mongoose/customer.mongoose.repository";
import { FeedMongooseRepository } from "./repositories/mongoose/feed.mongoose.repository";
import { FeedFilteredFormatMongooseRepository } from "./repositories/mongoose/feed-filtered-format.mongoose.repository";
import { SupporterMongooseRepository } from "./repositories/mongoose/supporter.mongoose.repository";
import { UserFeedMongooseRepository } from "./repositories/mongoose/user-feed.mongoose.repository";
import { DiscordApiService } from "./services/discord-api/discord-api.service";
import { DiscordAuthService } from "./services/discord-auth/discord-auth.service";
import { DiscordPermissionsService } from "./services/discord-permissions/discord-permissions.service";
import { DiscordWebhooksService } from "./services/discord-webhooks/discord-webhooks.service";
import { FeedFetcherApiService } from "./services/feed-fetcher-api/feed-fetcher-api.service";
import { FeedHandlerService } from "./services/feed-handler/feed-handler.service";
import { GuildSubscriptionsService } from "./services/guild-subscriptions/guild-subscriptions.service";
import { MessageBrokerService } from "./services/message-broker/message-broker.service";
import { PaddleService } from "./services/paddle/paddle.service";
import { PatronsService } from "./services/patrons/patrons.service";
import { RedditApiService } from "./services/reddit-api/reddit-api.service";
import { SupportersService } from "./services/supporters/supporters.service";
import { UsersService } from "./services/users/users.service";
import { DiscordUsersService } from "./services/discord-users/discord-users.service";
import { FeedSchedulingService } from "./services/feed-scheduling/feed-scheduling.service";
import { FeedsService } from "./services/feeds/feeds.service";
import { NotificationsService } from "./services/notifications/notifications.service";
import { DiscordServersService } from "./services/discord-servers/discord-servers.service";
import { UserFeedConnectionEventsService } from "./services/user-feed-connection-events/user-feed-connection-events.service";
import { MongoMigrationsService } from "./services/mongo-migrations/mongo-migrations.service";
import { UserFeedsService } from "./services/user-feeds/user-feeds.service";
import { FeedConnectionsDiscordChannelsService } from "./services/feed-connections-discord-channels/feed-connections-discord-channels.service";
import { createSmtpTransport } from "./infra/smtp";

export interface Container {
  config: Config;
  mongoConnection: MongoConnection;
  rabbitmq: RabbitConnection;
  authService: AuthService;
  publishMessage: (queue: string, message: unknown) => Promise<void>;

  // Repositories (interface types for abstraction)
  mongoMigrationRepository: IMongoMigrationRepository;
  failRecordRepository: IFailRecordRepository;
  bannedFeedRepository: IBannedFeedRepository;
  feedScheduleRepository: IFeedScheduleRepository;
  discordServerProfileRepository: IDiscordServerProfileRepository;
  userFeedLimitOverrideRepository: IUserFeedLimitOverrideRepository;
  patronRepository: IPatronRepository;
  notificationDeliveryAttemptRepository: INotificationDeliveryAttemptRepository;
  feedSubscriberRepository: IFeedSubscriberRepository;
  userRepository: IUserRepository;
  customerRepository: ICustomerRepository;
  feedRepository: IFeedRepository;
  feedFilteredFormatRepository: IFeedFilteredFormatRepository;
  supporterRepository: ISupporterRepository;
  userFeedRepository: IUserFeedRepository;

  // External API Services
  discordApiService: DiscordApiService;
  discordAuthService: DiscordAuthService;
  discordPermissionsService: DiscordPermissionsService;
  discordWebhooksService: DiscordWebhooksService;
  feedFetcherApiService: FeedFetcherApiService;
  feedHandlerService: FeedHandlerService;
  paddleService: PaddleService;
  redditApiService: RedditApiService;

  // Core Services
  guildSubscriptionsService: GuildSubscriptionsService;
  messageBrokerService: MessageBrokerService;
  patronsService: PatronsService;
  supportersService: SupportersService;
  usersService: UsersService;
  discordUsersService: DiscordUsersService;
  feedSchedulingService: FeedSchedulingService;
  feedsService: FeedsService;
  notificationsService: NotificationsService;
  discordServersService: DiscordServersService;
  userFeedConnectionEventsService: UserFeedConnectionEventsService;
  mongoMigrationsService: MongoMigrationsService;
  userFeedsService: UserFeedsService;
  feedConnectionsDiscordChannelsService: FeedConnectionsDiscordChannelsService;
}

export function createContainer(deps: {
  config: Config;
  mongoConnection: MongoConnection;
  rabbitmq: RabbitConnection;
}): Container {
  const authService = createAuthService(deps.config);
  const publishMessage = createPublisher(deps.rabbitmq);

  // Repositories
  const mongoMigrationRepository = new MongoMigrationMongooseRepository(
    deps.mongoConnection,
  );
  const failRecordRepository = new FailRecordMongooseRepository(
    deps.mongoConnection,
  );
  const bannedFeedRepository = new BannedFeedMongooseRepository(
    deps.mongoConnection,
  );
  const feedScheduleRepository = new FeedScheduleMongooseRepository(
    deps.mongoConnection,
  );
  const discordServerProfileRepository =
    new DiscordServerProfileMongooseRepository(deps.mongoConnection);
  const userFeedLimitOverrideRepository =
    new UserFeedLimitOverrideMongooseRepository(deps.mongoConnection);
  const patronRepository = new PatronMongooseRepository(deps.mongoConnection);
  const notificationDeliveryAttemptRepository =
    new NotificationDeliveryAttemptMongooseRepository(deps.mongoConnection);
  const feedSubscriberRepository = new FeedSubscriberMongooseRepository(
    deps.mongoConnection,
  );
  const userRepository = new UserMongooseRepository(deps.mongoConnection);
  const customerRepository = new CustomerMongooseRepository(
    deps.mongoConnection,
  );
  const feedRepository = new FeedMongooseRepository(deps.mongoConnection);
  const feedFilteredFormatRepository = new FeedFilteredFormatMongooseRepository(
    deps.mongoConnection,
  );
  const supporterRepository = new SupporterMongooseRepository(
    deps.mongoConnection,
  );
  const userFeedRepository = new UserFeedMongooseRepository(
    deps.mongoConnection,
  );

  // External API Services
  const discordApiService = new DiscordApiService(deps.config);
  const discordAuthService = new DiscordAuthService(
    deps.config,
    discordApiService,
  );
  const discordPermissionsService = new DiscordPermissionsService(
    deps.config,
    discordApiService,
  );
  const discordWebhooksService = new DiscordWebhooksService(
    deps.config,
    discordApiService,
  );
  const feedFetcherApiService = new FeedFetcherApiService(deps.config);
  const feedHandlerService = new FeedHandlerService(deps.config);
  const paddleService = new PaddleService(deps.config);
  const redditApiService = new RedditApiService(deps.config);

  // Core Services
  const guildSubscriptionsService = new GuildSubscriptionsService(deps.config);
  const messageBrokerService = new MessageBrokerService(publishMessage);
  const patronsService = new PatronsService(deps.config);
  const supportersService = new SupportersService({
    config: deps.config,
    patronsService,
    guildSubscriptionsService,
    discordApiService,
    supporterRepository,
    userFeedLimitOverrideRepository,
  });

  const usersService = new UsersService({
    config: deps.config,
    userRepository,
    userFeedRepository,
    supporterRepository,
    supportersService,
    paddleService,
  });

  const discordUsersService = new DiscordUsersService({
    config: deps.config,
    discordApiService,
    supportersService,
  });

  const feedSchedulingService = new FeedSchedulingService({
    config: deps.config,
    supportersService,
    feedScheduleRepository,
  });

  const feedsService = new FeedsService({
    feedRepository,
    bannedFeedRepository,
    feedSchedulingService,
    discordApiService,
    discordAuthService,
    discordPermissionsService,
  });

  const smtpTransport = createSmtpTransport(deps.config);

  const notificationsService = new NotificationsService({
    config: deps.config,
    smtpTransport,
    usersService,
    userFeedRepository,
    notificationDeliveryAttemptRepository,
  });

  const discordServersService = new DiscordServersService({
    config: deps.config,
    discordApiService,
    feedsService,
    discordPermissionsService,
    discordServerProfileRepository,
  });

  const userFeedConnectionEventsService = new UserFeedConnectionEventsService({
    userFeedRepository,
  });

  const mongoMigrationsService = new MongoMigrationsService({
    mongoMigrationRepository,
    userFeedRepository,
    userRepository,
  });

  const feedConnectionsDiscordChannelsService =
    new FeedConnectionsDiscordChannelsService({
      config: deps.config,
      feedsService,
      userFeedRepository,
      feedHandlerService,
      supportersService,
      discordWebhooksService,
      discordApiService,
      discordAuthService,
      connectionEventsService: userFeedConnectionEventsService,
      usersService,
    });

  const userFeedsService = new UserFeedsService({
    config: deps.config,
    userFeedRepository,
    userRepository,
    feedsService,
    supportersService,
    feedFetcherApiService,
    feedHandlerService,
    usersService,
    publishMessage,
    feedConnectionsDiscordChannelsService,
  });

  return {
    config: deps.config,
    mongoConnection: deps.mongoConnection,
    rabbitmq: deps.rabbitmq,
    authService,
    publishMessage,

    // Repositories
    mongoMigrationRepository,
    failRecordRepository,
    bannedFeedRepository,
    feedScheduleRepository,
    discordServerProfileRepository,
    userFeedLimitOverrideRepository,
    patronRepository,
    notificationDeliveryAttemptRepository,
    feedSubscriberRepository,
    userRepository,
    customerRepository,
    feedRepository,
    feedFilteredFormatRepository,
    supporterRepository,
    userFeedRepository,

    // External API Services
    discordApiService,
    discordAuthService,
    discordPermissionsService,
    discordWebhooksService,
    feedFetcherApiService,
    feedHandlerService,
    paddleService,
    redditApiService,

    // Core Services
    guildSubscriptionsService,
    messageBrokerService,
    patronsService,
    supportersService,
    usersService,
    discordUsersService,
    feedSchedulingService,
    feedsService,
    notificationsService,
    discordServersService,
    userFeedConnectionEventsService,
    mongoMigrationsService,
    userFeedsService,
    feedConnectionsDiscordChannelsService,
  };
}
