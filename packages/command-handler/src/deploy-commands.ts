import 'reflect-metadata';
import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v9';
import config from './config';
import commands from './interaction-handlers/commands';

const { clientId, token } = {
  token: config.botToken,
  clientId: config.botClientId,
};

const commandsJSON = Array.from(commands.values()).map(command => {
  // @ts-ignore
  return command.data.toJSON();
});

const rest = new REST({ version: '9' }).setToken(token);

(async () => {
  try {
    await rest.put(
      Routes.applicationGuildCommands(clientId, config.testingGuildId),
      { body: commandsJSON },
    );

    console.log('Successfully registered application commands.');
  } catch (error) {
    console.error(error);
  }
})();
