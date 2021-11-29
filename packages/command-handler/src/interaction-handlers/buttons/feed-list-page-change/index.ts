import { ButtonInteraction } from 'discord.js';
import { inject, injectable } from 'inversify';
import { 
  InteractionServices,
  InteractionContainerSymbols,
  InteractionLogger,
} from '../../interaction-container.type';
import InteractionCustomId, {
  InteractionPaginationData,
} from '../../interaction-custom-id.type';
import selectFeedComponents from '../../../utils/select-feed-components';
import ButtonsInterface from '../buttons.interface';

@injectable()
export default class FeedListPageChangeButton implements ButtonsInterface {
  @inject(InteractionContainerSymbols.Services) services!: InteractionServices;

  @inject(InteractionContainerSymbols.Logger) logger!: InteractionLogger;

  async execute(
    interaction: ButtonInteraction,
    customIdObject: InteractionCustomId<InteractionPaginationData>,
  ): Promise<void> {
    const pageNumber = Number(customIdObject.data?.pageNumber);

    if (isNaN(pageNumber)) {
      throw new Error(`Invalid page number ${customIdObject.data?.pageNumber}`);
    }


    await interaction.update({
      components: await selectFeedComponents(
        this.services,
        interaction.guildId,
        interaction.channelId,
        customIdObject.finalTask,
        customIdObject.data?.pageNumber,
      ),
    });
  }
}
