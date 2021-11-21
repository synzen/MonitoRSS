import { SelectMenuInteraction } from 'discord.js';
import { inject, injectable } from 'inversify';
import {
  commandContainerSymbols,
  CommandLogger,
  CommandServices,
  CommandTranslate,
} from '../../types/command-container.type';
import ResponseInterface from '../response.interface';

@injectable()
export default class ResponseRemoveFeed implements ResponseInterface {
  @inject(commandContainerSymbols.CommandServices) commandServices!: CommandServices;

  @inject(commandContainerSymbols.CommandLogger) logger!: CommandLogger;

  @inject(commandContainerSymbols.CommandTranslate) translate!: CommandTranslate;

  /**
   * The ID that will be used for recognizing Discord interactions that this response can handle.
   */
  static customId = 'remove-feed';

  async execute(interaction: SelectMenuInteraction): Promise<void> {
    // const feedId = interaction.values[0];

    await interaction.deferReply();

    // TODO: Potentially add more restrictions on the feed removal by checking guild id
    // await this.commandServices.guildService.removeFeed(feedId);
    await interaction.editReply(this.translate('responses.remove-feed.success'));
  }
}
