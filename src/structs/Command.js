const path = require('path')
const fsPromises = require('fs').promises
const Discord = require('discord.js')
const { DiscordPromptRunner } = require('discord.js-prompts')
const Profile = require('../structs/db/Profile.js')
const Blacklist = require('../structs/db/Blacklist.js')
const BlacklistCache = require('../structs/BlacklistCache.js')
const Permissions = Discord.Permissions.FLAGS
const getConfig = require('../config.js').get

class Command {
  /**
   * @param {string} name - Command name
   * @param {function} func - Command function
   * @param {boolean} owner - If this is an owner command
   */
  constructor (name, func, owner = false) {
    this.owner = owner
    this.name = name
    this.func = func
  }

  static get USER_PERMISSIONS () {
    return {
      sub: [],
      unsub: [],
      'sub.filters': []
    }
  }

  static get BOT_PERMISSIONS () {
    return {
      clone: [Permissions.EMBED_LINKS],
      date: [Permissions.EMBED_LINKS],
      dump: [Permissions.EMBED_LINKS, Permissions.ATTACH_FILES],
      embed: [Permissions.EMBED_LINKS],
      filters: [Permissions.EMBED_LINKS],
      list: [Permissions.EMBED_LINKS],
      mention: [Permissions.EMBED_LINKS],
      move: [Permissions.EMBED_LINKS],
      options: [Permissions.EMBED_LINKS],
      remove: [Permissions.EMBED_LINKS],
      refresh: [Permissions.EMBED_LINKS],
      split: [Permissions.EMBED_LINKS],
      sub: [Permissions.EMBED_LINKS, Permissions.MANAGE_ROLES],
      test: [Permissions.EMBED_LINKS],
      text: [Permissions.EMBED_LINKS],
      unsub: [Permissions.EMBED_LINKS, Permissions.MANAGE_ROLES],
      webhook: [Permissions.EMBED_LINKS]
    }
  }

  /**
   * Set the enabled flag to true
   */
  static enable () {
    this.enabled = true
  }

  /**
   * Set the enabled flag to false
   */
  static disable () {
    this.enabled = false
  }

  /**
   * If an ID is blacklisted from commands
   * @param {string} id
   */
  static isBlacklistedID (id) {
    return this.blacklistCache.users.has(id) || this.blacklistCache.guilds.has(id)
  }

  /**
   * If a message should skip command parsing
   * @param {import('discord.js').Message} message
   * @param {import('pino').Logger} log
   */
  static shouldIgnore (message, log) {
    const { author, client, guild, channel } = message
    if (!guild) {
      log.trace('Ignored message from non-guild')
      return true
    } else if (author.id === client.user.id) {
      log.trace('Ignored message from self (bot)')
      return true
    } else if (DiscordPromptRunner.isActiveChannel(channel.id)) {
      log.trace('Ignored message because of active menu in channel')
      return true
    } else if (this.isBlacklistedID(guild.id)) {
      log.trace('Ignored message from blacklisted guild')
      return true
    } else if (this.isBlacklistedID(author.id)) {
      log.trace('Ignored message from blacklisted user')
      return true
    }
    return false
  }

  /**
   * Check if an ID is a owner's
   * @param {string} id
   */
  static isOwnerID (id) {
    const config = getConfig()
    /** @type {stirng[]} */
    const ownerIDs = config.bot.ownerIDs
    return ownerIDs.includes(id)
  }

  /**
   * Get the permission names required
   * @param {number[]} numbers - Permission values
   * @returns {string[]}
   */
  static getPermissionNames (numbers) {
    const permissions = numbers.reduce((accumulated, cur) => {
      return accumulated.add(cur)
    }, new Discord.Permissions())
    return permissions.toArray()
  }

  /**
   * Return list of command names
   * @param {boolean} owner - If owner commands
   */
  static async readCommands (owner) {
    const folderPath = path.join(__dirname, '..', 'commands', owner ? 'owner' : '')
    const fileNames = await fsPromises.readdir(folderPath)
    return fileNames.filter(name => /\.js$/.test(name)).map(name => name.replace('.js', ''))
  }

  /**
   * Read and store all commands
   */
  static async initialize () {
    if (this.initialized) {
      return
    }
    this.blacklistCache = new BlacklistCache(await Blacklist.getAll())
    const commandNames = await this.readCommands()
    for (const name of commandNames) {
      const func = require(`../commands/${name}.js`)
      this.commands.set(name, new Command(name, func))
    }
    const ownerCommandNames = await this.readCommands(true)
    for (const name of ownerCommandNames) {
      const func = require(`../commands/owner/${name}.js`)
      this.commands.set(name, new Command(name, func, true))
    }
    this.initialized = true
  }

  /**
   * Get the default prefix
   * @returns {string}
   */
  static getDefaultPrefix () {
    const config = getConfig()
    return config.bot.prefix
  }

  /**
   * Gets a guild's prefix
   * @param {string} guildID
   * @returns {string}
   */
  static getPrefix (guildID) {
    const guildPrefix = Profile.getPrefix(guildID)
    return guildPrefix || this.getDefaultPrefix()
  }

  /**
   * Try to get a command name from user input
   * @param {string} string
   * @param {boolean} withDefault
   * @returns {Promise<string>} - The command name
   */
  static parseForName (string, prefix) {
    if (!string.startsWith(prefix)) {
      return ''
    }
    // This assumes the prefix has no spaces
    const target = string.split(' ')[0]
    const name = target.slice(prefix.length, target.length)
    return name
  }

  /**
   * Try to get a Command from a message
   * @param {import('discord.js').Message} message
   * @param {import('pino').Logger} log
   */
  static tryGetCommand (message, log) {
    const { guild } = message
    // With guild prefix
    const guildPrefix = this.getPrefix(guild.id)
    let name = this.parseForName(message.content, guildPrefix)
    let command = this.get(name)
    log.trace(`Parsed for command name with guild prefix as ${name}`)
    if (command) {
      return command
    }
    // With default prefix
    const defaultPrefix = this.getDefaultPrefix()
    name = this.parseForName(message.content, defaultPrefix)
    log.trace(`Parsed for command name with default prefix as ${name}`)
    command = this.get(name)
    return command
  }

  /**
   * If a command exists
   * @param {string} name
   * @returns {boolean}
   */
  static has (name) {
    return Command.commands.has(name)
  }

  /**
   * Get a command
   * @param {string} name
   * @returns {Command}
   */
  static get (name) {
    return Command.commands.get(name)
  }

  /**
   * Get the required user permissions
   * @returns {number[]}
   */
  getMemberPermission () {
    const name = this.name
    if (name in Command.USER_PERMISSIONS) {
      return Command.USER_PERMISSIONS[name]
    } else {
      return [Permissions.MANAGE_CHANNELS]
    }
  }

  /**
   * Get the required bot permissions
   * @returns {number[]}
   */
  getBotPermissions () {
    const name = this.name
    const base = [Permissions.SEND_MESSAGES]
    if (name in Command.BOT_PERMISSIONS) {
      return Command.BOT_PERMISSIONS[name].concat(base)
    } else {
      return base
    }
  }

  /**
   * Check if a user has permission to run this command
   * @param {import('discord.js').Message} message
   * @returns {boolean}
   */
  hasMemberPermission (message) {
    const { member, channel } = message
    const isOwnerUser = Command.isOwnerID(member.user.id)
    if (isOwnerUser || this.owner) {
      return isOwnerUser
    }
    const memberPermissions = this.getMemberPermission()
    return member.permissionsIn(channel).has(memberPermissions)
  }

  /**
   * Check if the bot has permission to run this command
   * @param {import('discord.js').Message} message
   * @returns {boolean}
   */
  hasBotPermission (message) {
    const { channel, guild } = message
    const botPermissions = this.getBotPermissions()
    return guild.me.permissionsIn(channel).has(botPermissions)
  }

  /**
   * Send a message about sending missing bot perms
   * @param {import('discord.js').Message} message
   * @returns {string[]} - Permissio names
   */
  async notifyMissingBotPerms (message) {
    const channel = message.channel
    const permissionNames = Command.getPermissionNames(this.getBotPermissions())
    if (!message.guild.me.permissionsIn(message.channel).has(Permissions.SEND_MESSAGES)) {
      return permissionNames
    }
    await channel.send(`I am missing one of the following permissions:\n\n${permissionNames.join('\n')}`)
    return permissionNames
  }

  /**
   * Send a message about missing member perms
   * @param {import('discord.js').Message} message
   * @returns {string[]} - Permission names
   */
  async notifyMissingMemberPerms (message) {
    const channel = message.channel
    const permissionNames = Command.getPermissionNames(this.getMemberPermission())
    if (!message.guild.me.permissionsIn(message.channel).has(Permissions.SEND_MESSAGES)) {
      return permissionNames
    }
    if (this.owner) {
      await message.channel.send('You must be an owner to use this command.')
      return ['owner']
    }
    await channel.send(`You are missing one of the following permissions:\n\n${permissionNames.join('\n')}`)
    return permissionNames
  }

  /**
   * Run a command
   * @param {import('discord.js').Message} message
   */
  async run (message) {
    const channelID = message.channel.id
    DiscordPromptRunner.addActiveChannel(channelID)
    try {
      await this.func(message, this.name)
    } finally {
      DiscordPromptRunner.deleteActiveChannel(channelID)
    }
  }
}

/**
 * If commands have been read and stored
 */
Command.initialized = false

/**
 * If commands are enabled
 */
Command.enabled = false

/**
 * Initialized non-owner commands
 * @type {Map<string, Command>}
 */
Command.commands = new Map()

module.exports = Command
