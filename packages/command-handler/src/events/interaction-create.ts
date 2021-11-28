import { MonitoServices } from '@monitorss/services';
import {
  ButtonInteraction,
  CommandInteraction,
  Interaction,
  SelectMenuInteraction,
} from 'discord.js';
import { Container } from 'inversify';
import mapOfCommands from '../commands';
import mapOfResponses from '../responses';
import ResponseInterface from '../responses/response.interface';
import { 
  CommandProfile,
  CommandLogger,  
  CommandTranslate,
  CommandServices,
  commandContainerSymbols,
} from '../types/command-container.type';
import Logger from '../utils/logger';
import parseInteractionCustomId from '../utils/parse-interaction.custom-id';
import { createLocaleTranslator } from '../utils/translate';

async function handleCommandInteraction(
  interaction: CommandInteraction,
  container: Container,
) {
  const { commandName } = interaction;
  const Command = mapOfCommands.get(commandName);
  const logger = container.get<CommandLogger>(commandContainerSymbols.CommandLogger);

  if (!Command) {
    logger.debug(`No command found for ${commandName}`);

    return;
  }

  logger.setContext({
    ...logger.context,
    command: {
      name: commandName,
      options: interaction.options.data,
    },
  });

  container.bind(Command).to(Command);
  const command = container.get(Command);
  await command.execute(interaction);
}

async function handleCommandResponse(
  interaction: SelectMenuInteraction | ButtonInteraction,
  container: Container,
) {
  const { customId: customIdString } = interaction;
  const customIdObject = parseInteractionCustomId<Record<string, any>>(customIdString);

  if (!customIdObject) {    
    return;
  }

  const logger = container.get<CommandLogger>(commandContainerSymbols.CommandLogger);

  const Response = mapOfResponses.get(customIdObject.task);

  if (!Response) {
    logger.debug(`No response found for custom id ${customIdObject.task}`);

    return;
  }


  logger.setContext({
    ...logger.context,
    response: {
      customId: customIdObject,
    },
  });

  container.bind(Response).to(Response);
  const response = container.get<ResponseInterface>(Response);
  await response.execute(interaction, customIdObject);
}

async function interactionCreate(
  interaction: Interaction,
  monitoServices: MonitoServices,
) {
  if (!interaction.guildId || !interaction.channelId) {
    console.log('No guild or channel found');
    
    return;
  }

  const logger = new Logger().setContext({
    interaction: {
      guildId: interaction.guildId,
      channelId: interaction.channelId,
      userId: interaction.member.user.id,
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

  try {
    if (interaction.isCommand()) {
      await handleCommandInteraction(interaction, container);
    } else if (interaction.isSelectMenu() || interaction.isButton()) {
      await handleCommandResponse(interaction, container);
    }
  } catch (error) {
    logger.error('Failed to handle interaction', error as Error);
  }

}

export default interactionCreate;
