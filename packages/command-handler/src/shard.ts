import { Client, Intents } from 'discord.js';
import commands from './commands';
import config from './config';

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
    command.execute(interaction);
  } catch (err) {
    console.error(err);
  }
});

client.once('ready', () => {
  console.log('Ready!');
});

client.login(config.BOT_TOKEN);
