import { ButtonInteraction } from 'discord.js';
import { Container } from 'inversify';
import mapOfResponses from '../../interaction-handlers/buttons';
import ButtonsInterface from '../../interaction-handlers/buttons/buttons.interface';
import { commandContainerSymbols, CommandLogger } from '../../types/command-container.type';
import parseInteractionCustomId from '../../utils/parse-interaction.custom-id';

async function buttonInteractionEvent(
  interaction: ButtonInteraction,
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
  const response = container.get<ButtonsInterface>(Response);
  await response.execute(interaction, customIdObject);
}

export default buttonInteractionEvent;
