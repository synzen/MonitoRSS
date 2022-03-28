import { CommandInteraction } from 'discord.js';
import { SlashCommandBuilder } from '@discordjs/builders';
import CommandInterface from '../command.interface';
import { injectable } from 'inversify';
import fs from 'fs';
import path from 'path';

const packageJson = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../../../../package.json'), 'utf8'));

@injectable()
class CommandVersion implements CommandInterface {
  static data = new SlashCommandBuilder()
    .setName('version')
    .setDescription('Check the version of the command handler');

  async execute(interaction: CommandInteraction): Promise<void> {
    await interaction.reply(packageJson.version);
  }
}

export default CommandVersion;
