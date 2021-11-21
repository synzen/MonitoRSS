import { SelectMenuInteraction } from 'discord.js';

interface ResponseInterface {
  execute(interaction: SelectMenuInteraction): Promise<void>
}

export default ResponseInterface;
