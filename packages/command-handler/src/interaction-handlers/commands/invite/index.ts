import { CommandInteraction } from 'discord.js';
import { SlashCommandBuilder } from '@discordjs/builders';
import CommandInterface from '../command.interface';
import { inject, injectable } from 'inversify';
import {
  InteractionContainerSymbols,
  InteractionTranslate,
} from '../../interaction-container.type';
import config from '../../../config';

@injectable()
class CommandInvite implements CommandInterface {
  @inject(InteractionContainerSymbols.Translate) translate!: InteractionTranslate;

  static data = new SlashCommandBuilder()
    .setName('invite')
    .setDescription('Get an invite link for the bot');

  async execute(interaction: CommandInteraction): Promise<void> {
    const inviteUrl = config.botInviteUrl;
    await interaction.reply(this.translate('commands.invite.text', {
      url: inviteUrl,
    }));
  }
}

export default CommandInvite;
