import { Client } from 'discord.js';
import commands from './commands';
import config from './config';
import setupServices from '@monitorss/services';
import logger from './utils/logger';

async function shard() {
  const services = await setupServices({
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

  client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) {
      return;
    }

    const { commandName } = interaction;
    const command = commands.get(commandName);

    if (!command) {
      return;
    }

    try {
      await command.execute(interaction, services);
    } catch (error) {
      logger.error(`Failed to execute command ${commandName}`, error as Error, {
        interaction: {
          guildId: interaction.guildId,
          channelId: interaction.channelId,
          userId: interaction.member.user.id,
          name: interaction.commandName,
          options: interaction.options.data,
        },
      });
    }
  });

  client.once('ready', () => {
    logger.info(`Client shard ${client.shard?.ids[0]} ready`);
  });

  client.login(config.botToken);
}

shard();
