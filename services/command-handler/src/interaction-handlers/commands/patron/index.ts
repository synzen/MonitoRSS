import { CommandInteraction } from 'discord.js';
import { SlashCommandBuilder } from '@discordjs/builders';
import CommandInterface from '../command.interface';
import { inject, injectable } from 'inversify';
import { 
  InteractionContainerSymbols,
  InteractionLogger,
  InteractionServices,
  InteractionTranslate, 
} from '../../interaction-container.type';
import { DiscordAPIError, REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v9';
import config from '../../../config';

@injectable()
class CommandPatron implements CommandInterface {
  @inject(InteractionContainerSymbols.Services) services!: InteractionServices;

  @inject(InteractionContainerSymbols.Translate) translate!: InteractionTranslate;

  @inject(InteractionContainerSymbols.Logger) logger!: InteractionLogger;

  static data = new SlashCommandBuilder()
    .setName('patron')
    .setDescription('Add a server to be under your patron backing')
    .addSubcommandGroup(subCommandGroup => subCommandGroup
      .setName('servers')
      .setDescription('Manage servers under your patron backing')
      .addSubcommand(subCommand => subCommand
        .setName('add')
        .setDescription('Add a server under your patron backing')
        .addStringOption(option => option
          .setRequired(false)
          .setName('server-id')
          .setDescription(
            'The ID of the server to add. If no ID is given, the current server will be added',
          )))
      .addSubcommand(subCommand => subCommand
        .setName('remove')
        .setDescription('Remove a server under your patron backing')
        .addStringOption(option => option
          .setRequired(false)
          .setName('server-id')
          .setDescription(
            'The ID of the server to remove. If no ID is given, the current server will be removed',
          )))
      .addSubcommand(subCommand => subCommand
        .setName('list')
        .setDescription('List all servers under your patron backing')));
    
    

  async execute(interaction: CommandInteraction): Promise<void> {
    const isSupporter = await this.services.discordUserService
      .isSupporter(interaction.member.user.id);

    if (!isSupporter) {
      await interaction.reply(this.translate('commands.patron.not_patron'));
    }

    const subCommandName = interaction.options.getSubcommand(true);

    if (subCommandName === 'add') {
      await this.handleAddServer(interaction);
    }

    if (subCommandName === 'remove') {
      await this.handleRemoveServer(interaction);
    }

    if (subCommandName === 'list') {
      await this.handleListServers(interaction);
    }
  }

  private async handleAddServer(interaction: CommandInteraction): Promise<void> {
    if (await this.supporterIsAtGuildLimit(interaction.member.user.id)) {
      await interaction.reply(this.translate('commands.patron.add_server_limit'));

      return;
    }

    const serverId = interaction.options.getString('server-id') || interaction.guildId;

    const guildName = await this.getGuildName(serverId);
    
    if (!guildName) {
      await interaction.reply(this.translate('commands.patron.add_server_failure', {
        server: serverId,
      }));
      
      return;
    }
    
    await this.services.discordUserService.addSupporterGuild(interaction.member.user.id, serverId);
  
    await interaction.reply(this.translate('commands.patron.add_server_success', {
      server: `${serverId} (${guildName})`,
    }));
  }

  private async handleRemoveServer(interaction: CommandInteraction): Promise<void> {
    const serverId = interaction.options.getString('server-id') || interaction.guildId;

    await this.services.discordUserService
      .removeSupporterGuild(interaction.member.user.id, serverId);

    await interaction.reply(this.translate('commands.patron.remove_server_success', {
      server: `${serverId} (${await this.getGuildName(serverId)})`,
    }));
  }

  private async handleListServers(interaction: CommandInteraction): Promise<void> {
    const guilds = await this.services.discordUserService
      .getSupporterGuilds(interaction.member.user.id);

    if (!guilds.length) {
      await interaction.reply(this.translate('commands.patron.list_no_servers'));

      return;
    }

    const guildStrings = await Promise.all(guilds.map(async guildId => {
      return `${guildId} (${await this.getGuildName(guildId)})`;
    }));

    await interaction.reply(this.translate('commands.patron.list_servers', {
      servers: guildStrings.join('\n'),
    }));
  }
  
  private async getGuildName(serverId: string): Promise<string> {
    const { botToken } = config;

    const rest = new REST().setToken(botToken);

    try {
      const guild = await rest.get(Routes.guild(serverId)) as { name: string };
  
      return guild.name;
    } catch (err) {
      this.logger.info(`Failed to get guild name for server ${serverId}`, {
        err: (err as DiscordAPIError).stack,
      });

      return '';
    }
  }

  private async supporterIsAtGuildLimit(discordUserId: string): Promise<boolean> {
    const currentCount = (await this.services.discordUserService
      .getSupporterGuilds(discordUserId)).length;

    const maxCount = await this.services.discordUserService
      .getMaxSupporterGuildCount(discordUserId);

    return currentCount >= maxCount;
  }
}

export default CommandPatron;
