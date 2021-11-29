import { ButtonInteraction } from 'discord.js';
import { inject, injectable } from 'inversify';
import {
  commandContainerSymbols,
  CommandLogger,
  CommandServices,
  CommandTranslate,
} from '../../../types/command-container.type';
import InteractionCustomId, {
  InteractionPaginationData,
} from '../../../types/interaction-custom-id.type';
import selectFeedComponents from '../../../utils/select-feed-components';
import ButtonsInterface from '../buttons.interface';

@injectable()
export default class FeedListPageChangeButton implements ButtonsInterface {
  @inject(commandContainerSymbols.CommandServices) commandServices!: CommandServices;

  @inject(commandContainerSymbols.CommandLogger) logger!: CommandLogger;

  @inject(commandContainerSymbols.CommandTranslate) translate!: CommandTranslate;

  /**
   * The ID that will be used for recognizing Discord interactions that this response can handle.
   */
  static TASK_ID = 'list-feeds';

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
        this.commandServices,
        interaction.guildId,
        interaction.channelId,
        customIdObject.finalTask,
        customIdObject.data?.pageNumber,
      ),
    });
  }
}
