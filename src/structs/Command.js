const path = require('path')
const fsPromises = require('fs').promises
const Discord = require('discord.js')
const Profile = require('../structs/db/Profile.js')
const Blacklist = require('../structs/db/Blacklist.js')
const BlacklistCache = require('../structs/BlacklistCache.js')
const channelTracker = require('../util/channelTracker.js')
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
      unsub: []
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
      log.debug('Ignored message from non-guild')
      return true
    } else if (author.id === client.user.id) {
      log.debug('Ignored message from self (bot)')
      return true
    } else if (channelTracker.hasActiveMenus(channel.id)) {
      log.debug('Ignored message because of active menu in channel')
      return true
    } else if (this.isBlacklistedID(guild.id)) {
      log.debug('Ignored message from blacklisted guild')
      return true
    } else if (this.isBlacklistedID(author.id)) {
      log.debug('Ignored message from blacklisted user')
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
   * @param {import('discord.js').Message} message
   * @param {boolean} withDefault
   * @returns {Promise<string>} - The command name
   */
  static parseForName (message, prefix) {
    const { content } = message
    if (!content.startsWith(prefix)) {
      return ''
    }
    // This assumes the prefix has no spaces
    const target = content.split(' ')[0]
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
    let name = this.parseForName(message, guildPrefix)
    let command = this.get(name)
    log.debug(`Parsed for command name with guild prefix as ${name}`)
    if (command) {
      return command
    }
    // With default prefix
    const defaultPrefix = this.getDefaultPrefix()
    name = this.parseForName(message, defaultPrefix)
    log.debug(`Parsed for command name with default prefix as ${name}`)
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
    if (name in Command.BOT_PERMISSIONS) {
      return Command.BOT_PERMISSIONS[name]
    } else {
      return []
    }
  }

  /**
   * Check if a user has permission to run this command
   * @param {import('discord.js').Message} message
   * @returns {boolean}
   */
  async hasMemberPermission (message) {
    const { member, channel } = message
    if (this.owner) {
      return Command.isOwnerID(member.user.id)
    }
    if (!Command.enabled) {
      return false
    }
    const memberPermissions = this.getMemberPermission()
    const fetched = await member.fetch()
    return fetched.permissionsIn(channel).has(memberPermissions)
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
    await channel.send(`I am missing one of the following permissions:\n\n${permissionNames}`)
    return permissionNames
  }

  /**
   * Send a message about missing member perms
   * @param {import('discord.js').Message} message
   * @returns {string[]} - Permission names
   */
  async notifyMissingMemberPerms (message) {
    if (this.owner) {
      await message.channel.send('You must be an owner to use this command.')
      return ['owner']
    }
    const channel = message.channel
    const permissionNames = Command.getPermissionNames(this.getMemberPermission())
    await channel.send(`You are missing one of the following permissions:\n\n${permissionNames}`)
    return permissionNames
  }

  /**
   * Run a command
   * @param {import('discord.js').Message} message
   */
  async run (message) {
    const channelID = message.channel.id
    channelTracker.add(channelID)
    await this.func(message, this.name)
    channelTracker.remove(channelID)
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
