import { SlashCommandBuilder } from '@discordjs/builders';
import { CommandInteraction } from 'discord.js';
import { Services } from '@monitorss/services';

export interface Command {
  data: SlashCommandBuilder
  execute: (interaction: CommandInteraction, services: Services) => Promise<void>
}
