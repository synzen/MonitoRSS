import { MonitoServices } from '@monitorss/services';
import {
  Interaction,
} from 'discord.js';
import { Container } from 'inversify';
import { 
  CommandProfile,
  CommandLogger,  
  CommandTranslate,
  CommandServices,
  commandContainerSymbols,
} from '../../types/command-container.type';
import Logger from '../../utils/logger';
import { createLocaleTranslator } from '../../utils/translate';
import buttonInteractionEvent from './button-interaction.event';
import commandInteractionEvent from './command-interaction.event';
import selectMenuInteractionEvent from './select-menu-interaction.event';

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
      await commandInteractionEvent(interaction, container);
    } else if (interaction.isSelectMenu()) {
      await selectMenuInteractionEvent(interaction, container);
    } else if (interaction.isButton()) {
      await buttonInteractionEvent(interaction, container);
    }
  } catch (error) {
    logger.error('Failed to handle interaction', error as Error);
  }

}

export default interactionCreate;
