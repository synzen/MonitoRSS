import { CommandInteraction } from 'discord.js';
import { Container } from 'inversify';
import mapOfCommands from '../../interaction-handlers/commands';
import { 
  InteractionContainerSymbols,
  InteractionLogger,
} from '../../interaction-handlers/interaction-container.type';

async function commandInteractionEvent(
  interaction: CommandInteraction,
  container: Container,
) {
  const { commandName } = interaction;
  const Command = mapOfCommands.get(commandName);
  const logger = container.get<InteractionLogger>(InteractionContainerSymbols.Logger);

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

export default commandInteractionEvent;
