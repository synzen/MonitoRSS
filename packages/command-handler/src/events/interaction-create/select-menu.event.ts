import { SelectMenuInteraction } from 'discord.js';
import { Container } from 'inversify';
import mapOfResponses from '../../interaction-handlers/select-menus';
import SelectMenusInterface from '../../interaction-handlers/select-menus/select-menus.interface';
import { 
  InteractionContainerSymbols,
  InteractionLogger,
} from '../../interaction-handlers/interaction-container.type';
import {
  InteractionCustomIdParsed,
} from '../../interaction-handlers/interaction-custom-id.type';
import parseInteractionCustomId from '../../utils/parse-interaction.custom-id';

function getTaskFromCustomId<T>(customId: InteractionCustomIdParsed<T>) {
  if (customId.executeFinalTask) {
    return customId.finalTask;
  }

  return customId.task;
}

async function selectMenuInteractionEvent(
  interaction: SelectMenuInteraction,
  container: Container,
) {
  const logger = container.get<InteractionLogger>(InteractionContainerSymbols.Logger);
  const { customId: customIdString } = interaction;
  const customIdObject = parseInteractionCustomId<Record<string, any>>(customIdString);

  if (!customIdObject) {    
    logger.debug(`No custom id found for ${customIdString}`);

    return;
  }


  const task = getTaskFromCustomId(customIdObject);

  const Response = mapOfResponses.get(task);

  if (!Response) {
    logger.debug(`No response function found for custom id ${customIdObject.task}`);

    return;
  }


  logger.setContext({
    ...logger.context,
    response: {
      customId: customIdObject,
      values: interaction.values,
    },
  });

  container.bind(Response).to(Response);
  const response = container.get<SelectMenusInterface>(Response);
  await response.execute(interaction, customIdObject);
}

export default selectMenuInteractionEvent;
