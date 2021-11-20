import { SlashCommandBuilder } from '@discordjs/builders';
import { CommandInteraction } from 'discord.js';
import { Services as MonitoServices } from '@monitorss/services';
import Logger from '../utils/logger';

type Services = MonitoServices & {
  logger: Logger
};

export interface Command {
  data: SlashCommandBuilder
  execute: (interaction: CommandInteraction, services: Services) => Promise<void>
}
