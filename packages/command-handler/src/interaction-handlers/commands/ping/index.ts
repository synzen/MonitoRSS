import { CommandInteraction } from 'discord.js';
import { SlashCommandBuilder } from '@discordjs/builders';
import CommandInterface from '../command.interface';
import { injectable } from 'inversify';

@injectable()
class CommandPing implements CommandInterface {
  static data = new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Replies with Pong!');

  async execute(interaction: CommandInteraction): Promise<void> {
    await interaction.reply('Pong!');
  }
}

export default CommandPing;
