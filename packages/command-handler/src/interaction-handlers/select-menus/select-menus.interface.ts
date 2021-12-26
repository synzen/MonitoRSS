import { SelectMenuInteraction } from 'discord.js';
import { InteractionCustomIdParsed } from '../interaction-custom-id.type';

interface SelectMenusInterface {
  execute(
    interaction: SelectMenuInteraction,
    customIdObject: InteractionCustomIdParsed<Record<string, any>>
  ): Promise<void>
}

export default SelectMenusInterface;
