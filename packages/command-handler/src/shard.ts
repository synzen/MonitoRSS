import { Client, Intents } from 'discord.js';
import commands from './commands';
import config from './config';
import connect from '@monitorss/models';

async function shard() {
  const models = await connect(config.MONGO_URI);

  const client = new Client({ 
    intents: [
      Intents.FLAGS.GUILDS,
      Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
    ],  
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
      command.execute(interaction, models);
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
