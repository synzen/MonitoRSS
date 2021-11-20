import { Client } from 'discord.js';
import commands from './commands';
import config from './config';
import setupServices from '@monitorss/services';
import Logger from './utils/logger';

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

  client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) {
      return;
    }

    const { commandName } = interaction;
    const command = commands.get(commandName);

    if (!command) {
      return;
    }

    const logger = new Logger().setContext({
      interaction: {
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        userId: interaction.member.user.id,
        name: interaction.commandName,
        options: interaction.options.data,
      },
    });

    try {
      await command.execute(interaction, {
        ...monitoServices,
        logger,
      });
    } catch (error) {
      logger.error(`Failed to execute command ${commandName}`, error as Error, {

      });
    }
  });

  client.once('ready', () => {
    new Logger().info(`Client shard ${client.shard?.ids[0]} ready`);
  });

  client.login(config.botToken);
}

shard();
