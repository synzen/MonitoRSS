import { CommandInteraction } from 'discord.js';
import { SlashCommandBuilder } from '@discordjs/builders';
import CommandInterface from '../command.interface';
import { inject, injectable } from 'inversify';
import { 
  InteractionContainerSymbols, 
  InteractionServices,
  InteractionTranslate,
} from '../../interaction-container.type';
import fs from 'fs';
import path from 'path';

const validLocales = fs
  .readdirSync(path.join(__dirname, '../../../locales'), { withFileTypes: true })
  .filter(dirent => !dirent.isDirectory())
  .map(dirent => dirent.name.replace('.json', ''));

@injectable()
class CommandLocale implements CommandInterface {
  @inject(InteractionContainerSymbols.Services) services!: InteractionServices;

  @inject(InteractionContainerSymbols.Translate) translate!: InteractionTranslate;

  static data = new SlashCommandBuilder()
    .setName('locale')
    .setDescription('Set the locale/language of the commands')
    .addStringOption(option => option
      .setName('locale')
      .setRequired(true)
      .addChoices(validLocales.map((locale) => [locale, locale]))
      .setDescription('The locale/language to use'),
    );

  async execute(interaction: CommandInteraction): Promise<void> {
    const locale = interaction.options.getString('locale');

    if (!locale || !validLocales.includes(locale)) {
      throw new Error(`Invalid locale provided: ${locale}`);
    }

    await this.services.profileService.setLocale(interaction.guildId, locale);

    await interaction.reply(this.translate('commands.locale.success', {
      locale,
    }));
  }
}

export default CommandLocale;
