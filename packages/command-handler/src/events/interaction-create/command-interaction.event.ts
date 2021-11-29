import { CommandInteraction } from 'discord.js';
import { Container } from 'inversify';
import mapOfCommands from '../../interactions/commands';
import { commandContainerSymbols, CommandLogger } from '../../types/command-container.type';

async function commandInteractionEvent(
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

export default commandInteractionEvent;
