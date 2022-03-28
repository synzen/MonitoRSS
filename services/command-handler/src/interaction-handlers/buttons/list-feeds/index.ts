import { ButtonInteraction } from 'discord.js';
import { inject, injectable } from 'inversify';
import {
  InteractionContainerSymbols,
  InteractionLogger,
  InteractionServices,
  InteractionTranslate,
} from '../../interaction-container.type';
import {
  InteractionCustomIdParsed,
  InteractionPaginationData,
} from '../../interaction-custom-id.type';
import selectFeedComponents from '../../../utils/select-feed-components';
import ButtonsInterface from '../buttons.interface';

@injectable()
export default class ResponseListFeeds implements ButtonsInterface {
  @inject(InteractionContainerSymbols.Services) services!: InteractionServices;

  @inject(InteractionContainerSymbols.Logger) logger!: InteractionLogger;

  @inject(InteractionContainerSymbols.Translate) translate!: InteractionTranslate;

  /**
   * The ID that will be used for recognizing Discord interactions that this response can handle.
   */
  static TASK_ID = 'list-feeds';

  async execute(
    interaction: ButtonInteraction,
    customIdObject: InteractionCustomIdParsed<InteractionPaginationData>,
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
