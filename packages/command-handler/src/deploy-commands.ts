import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v9';
import config from './config';
import commands from './commands';

const { clientId, token } = {
  token: config.BOT_TOKEN,
  clientId: config.BOT_CLIENT_ID,
};

const commandsJSON = Array.from(commands.values()).map(command => command.data.toJSON());

const rest = new REST({ version: '9' }).setToken(token);

(async () => {
  try {
    await rest.put(
      Routes.applicationGuildCommands(clientId, config.TESTING_GUILD_ID),
      { body: commandsJSON },
    );

    console.log('Successfully registered application commands.');
  } catch (error) {
    console.error(error);
  }
})();
