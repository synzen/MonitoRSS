import { Services } from '@monitorss/services';
import { Interaction } from 'discord.js';
import mapOfCommands from '../commands';
import Logger from '../utils/logger';

async function interactionCreate(
  interaction: Interaction,
  monitoServices: Services,
) {
  if (!interaction.isCommand()) {
    return;
  }

  const { commandName } = interaction;
  const command = mapOfCommands.get(commandName);

  if (!command) {
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

  try {
    await command.execute(interaction, {
      ...monitoServices,
      logger,
    });
  } catch (error) {
    logger.error(`Failed to execute command ${commandName}`, error as Error);
  }
}

export default interactionCreate;
