import { CommandInteraction } from 'discord.js';

interface CommandInterface {
  execute(interaction: CommandInteraction): Promise<void>
}

export default CommandInterface;
