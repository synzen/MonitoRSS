import { MonitoServices } from '@monitorss/services';
import { Interaction } from 'discord.js';
import { Container } from 'inversify';
import mapOfCommands from '../commands';
import { 
  CommandProfile,
  CommandLogger,  
  CommandTranslate,
  CommandServices,
} from '../types/command-container.type';
import Logger from '../utils/logger';
import { createLocaleTranslator } from '../utils/translate';

export const containerTypes = {
  CommandTranslate: Symbol('CommandTranslate'),
  CommandProfile: Symbol('CommandProfile'),
  CommandServices: Symbol('CommandServices'),
  CommandLogger: Symbol('CommandLogger'),
};


async function interactionCreate(
  interaction: Interaction,
  monitoServices: MonitoServices,
) {
  if (!interaction.isCommand() || !interaction.guildId || !interaction.channelId) {
    return;
  }

  const { commandName } = interaction;
  const Command = mapOfCommands.get(commandName);

  if (!Command) {
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

  
  const profile = await monitoServices.profileService.findOne(interaction.guildId);
  const container = new Container();
  container.bind<CommandServices>(containerTypes.CommandServices).toConstantValue(monitoServices);
  container.bind<CommandLogger>(containerTypes.CommandLogger).toConstantValue(logger);
  container.bind<CommandProfile | null>(containerTypes.CommandProfile).toConstantValue(profile);
  container.bind<CommandTranslate>(containerTypes.CommandTranslate)
    .toConstantValue(createLocaleTranslator(profile?.locale));
  
  try {
    const command = new Command(container);
    await command.execute(interaction);
  } catch (error) {
    logger.error(`Failed to execute command ${commandName}`, error as Error);
  }
}

export default interactionCreate;
