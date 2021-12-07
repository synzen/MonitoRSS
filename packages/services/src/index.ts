import { Container } from 'inversify';
import 'reflect-metadata';
import configSchema, { Config } from './config-schema';
import { GuildService, SubscriptionService } from './services';
import { Db, MongoClient } from 'mongodb';
import ProfileService from './services/ProfileService';
import FeedService from './services/FeedService';
import SupporterService from './services/SupporterService';
import PatronService from './services/PatronService';
import FailRecordService from './services/FailRecordService';

export interface MonitoServices {
  mongoDbClient: MongoClient;
  guildService: GuildService;
  subscriptionService: SubscriptionService;
  profileService: ProfileService;
  feedService: FeedService;
  supporterService: SupporterService;
  patronService: PatronService;
  failRecordService: FailRecordService;
}

async function setup(inputConfig: Config): Promise<MonitoServices> {
  const config = configSchema.parse(inputConfig);
  const client = await MongoClient.connect(config.mongoUri);

  const container = new Container();
  container.bind<Config>('Config').toConstantValue(config);
  container.bind<Db>('MongoDB').toConstantValue(client.db());
  container.bind<GuildService>(GuildService).to(GuildService);
  container.bind<SubscriptionService>(SubscriptionService).to(SubscriptionService);
  container.bind<ProfileService>(ProfileService).to(ProfileService);
  container.bind<FeedService>(FeedService).to(FeedService);
  container.bind<SupporterService>(SupporterService).to(SupporterService);
  container.bind<PatronService>(PatronService).to(PatronService);
  container.bind<FailRecordService>(FailRecordService).to(FailRecordService);

  return {
    mongoDbClient: client,
    guildService: container.get<GuildService>(GuildService),
    subscriptionService: container.get<SubscriptionService>(SubscriptionService),
    profileService: container.get<ProfileService>(ProfileService),
    feedService: container.get<FeedService>(FeedService),
    supporterService: container.get<SupporterService>(SupporterService),
    patronService: container.get<PatronService>(PatronService),
    failRecordService: container.get<FailRecordService>(FailRecordService),
  };
}

export default setup; 
export { default as ERROR_CODES } from './services/constants/error-codes';
