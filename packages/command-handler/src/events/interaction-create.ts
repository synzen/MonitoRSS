import { MonitoServices } from '@monitorss/services';
import { Interaction } from 'discord.js';
import { Container } from 'inversify';
import mapOfCommands from '../commands';
import CommandInterface from '../commands/command.interface';
import { 
  CommandProfile,
  CommandLogger,  
  CommandTranslate,
  CommandServices,
  commandContainerSymbols,
} from '../types/command-container.type';
import Logger from '../utils/logger';
import { createLocaleTranslator } from '../utils/translate';

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
  container.bind<CommandServices>(commandContainerSymbols.CommandServices)
    .toConstantValue(monitoServices);
  container.bind<CommandLogger>(commandContainerSymbols.CommandLogger).toConstantValue(logger);
  container.bind<CommandProfile | null>(commandContainerSymbols.CommandProfile)
    .toConstantValue(profile);
  container.bind<CommandTranslate>(commandContainerSymbols.CommandTranslate)
    .toConstantValue(createLocaleTranslator(profile?.locale));
  container.bind(commandContainerSymbols.Command).to(Command);
  
  const command = container.get<CommandInterface>(commandContainerSymbols.Command);

  try {
    await command.execute(interaction);
  } catch (error) {
    logger.error(`Failed to execute command ${commandName}`, error as Error);
  }
}

export default interactionCreate;
