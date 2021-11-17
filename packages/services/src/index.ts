import { Container } from 'inversify';
import 'reflect-metadata';
import configSchema, { Config } from './config-schema';
import connect from '@monitorss/models';
import { GuildService, SubscriptionService } from './services';
import { MongoClient } from 'mongodb';

export interface Services {
  mongoDbClient: MongoClient;
  guildService: GuildService;
  subscriptionService: SubscriptionService;
}

async function setup(inputConfig: Config): Promise<Services> {
  const config = configSchema.parse(inputConfig);
  const modelExports = await connect(config.mongoUri);

  const container = new Container();
  container.bind<Config>('Config').toConstantValue(config);
  container.bind<typeof modelExports>('ModelExports').toConstantValue(modelExports);
  container.bind<GuildService>(GuildService).to(GuildService);
  container.bind<SubscriptionService>(SubscriptionService).to(SubscriptionService);

  return {
    mongoDbClient: modelExports.mongoDbClient,
    guildService: container.get<GuildService>(GuildService),
    subscriptionService: container.get<SubscriptionService>(SubscriptionService),
  };
}

export default setup; 
export { default as ERROR_CODES } from './services/constants/error-codes';
