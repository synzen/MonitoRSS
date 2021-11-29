import { ButtonInteraction } from 'discord.js';
import InteractionCustomId from '../interaction-custom-id.type';

interface ButtonsInterface {
  execute(
    interaction: ButtonInteraction,
    customIdObject: InteractionCustomId<Record<string, any>>
  ): Promise<void>
}

export default ButtonsInterface;
