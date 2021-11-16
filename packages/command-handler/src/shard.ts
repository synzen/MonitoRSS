import { Client } from 'discord.js';
import commands from './commands';
import config from './config';
import setupServices from '@monitorss/services';

async function shard() {
  const services = await setupServices({
    mongoUri: config.MONGO_URI,
    apis: {
      subscriptions: {
        host: 'config',
      },
    },
    defaultMaxFeeds: 15,
    defaultRefreshRateMinutes: 10,
  });

  const client = new Client({ 
    intents: [],  
  });

  client.on('interactionCreate', interaction => {
    if (!interaction.isCommand()) {
      return;
    }

    const { commandName } = interaction;
    const command = commands.get(commandName);

    if (!command) {
      return;
    }

    try {
      command.execute(interaction, services);
    } catch (err) {
      console.error(err);
    }
  });

  client.once('ready', () => {
    console.log('Ready!');
  });

  client.login(config.BOT_TOKEN);
}

shard();
