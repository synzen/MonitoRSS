import { SelectMenuInteraction } from 'discord.js';
import InteractionCustomId from '../interaction-custom-id.type';

interface SelectMenusInterface {
  execute(
    interaction: SelectMenuInteraction,
    customIdObject: InteractionCustomId<Record<string, any>>
  ): Promise<void>
}

export default SelectMenusInterface;
