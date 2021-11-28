import { ButtonInteraction, SelectMenuInteraction } from 'discord.js';
import InteractionCustomId from '../types/interaction-custom-id.type';

interface ResponseInterface {
  execute(
    interaction: SelectMenuInteraction | ButtonInteraction,
    customIdObject: InteractionCustomId<Record<string, any>>
  ): Promise<void>
}

export default ResponseInterface;
