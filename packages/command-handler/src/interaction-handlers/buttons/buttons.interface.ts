import { ButtonInteraction } from 'discord.js';
import { InteractionCustomIdParsed } from '../interaction-custom-id.type';

interface ButtonsInterface {
  execute(
    interaction: ButtonInteraction,
    customIdObject: InteractionCustomIdParsed<Record<string, any>>
  ): Promise<void>
}

export default ButtonsInterface;
