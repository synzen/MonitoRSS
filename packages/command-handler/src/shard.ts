import 'reflect-metadata';
import { Client } from 'discord.js';
import config from './config';
import setupServices from '@monitorss/services';
import interactionCreate from './events/interaction-create';
import readyEvent from './events/ready';

async function shard() {
  const monitoServices = await setupServices({
    mongoUri: config.mongoUri,
    apis: {
      subscriptions: {
        enabled: config.apis.subscriptions.enabled,
        host: config.apis.subscriptions.host,
        accessToken: config.apis.subscriptions.accessToken,
      },
    },
    defaultMaxFeeds: config.defaultMaxFeeds,
    defaultRefreshRateMinutes: config.defaultRefreshRateMinutes,
  });

  const client = new Client({ 
    intents: [],  
  });

  client.on('interactionCreate', interaction => interactionCreate(interaction, monitoServices));
  client.once('ready', () => readyEvent(client));
  client.login(config.botToken);
}

shard();
