const fs = require('fs')
const path = require('path')
const Discord = require('discord.js')
const createLogger = require('./logger/create.js')
const channelTracker = require('../util/channelTracker.js')
const config = require('../config.js')
const storage = require('./storage.js')
const MANAGE_CHANNELS_PERM = Discord.Permissions.FLAGS.MANAGE_CHANNELS
const EMBED_LINKS_PERM = Discord.Permissions.FLAGS.EMBED_LINKS
const MANAGE_ROLES_OR_PERMISSIONS_PERM = Discord.Permissions.FLAGS.MANAGE_ROLES

const PERMISSIONS = Object.keys(Discord.Permissions.FLAGS)

const loadOwnerCommand = async (file, message) => {
  const func = require(`../commands/owner/${file}.js`)
  await func(message)
}

const loadCommand = async (file, message, name) => {
  const func = require(`../commands/${file}.js`)
  await func(message, name)
}

const list = {
  help: {
    initLevel: 0,
    userPerm: MANAGE_CHANNELS_PERM
  },
  add: {
    initLevel: 2,
    userPerm: MANAGE_CHANNELS_PERM
  },
  remove: {
    initLevel: 2,
    botPerm: EMBED_LINKS_PERM,
    userPerm: MANAGE_CHANNELS_PERM
  },
  list: {
    initLevel: 1,
    botPerm: EMBED_LINKS_PERM,
    userPerm: MANAGE_CHANNELS_PERM
  },
  text: {
    initLevel: 1,
    botPerm: EMBED_LINKS_PERM,
    userPerm: MANAGE_CHANNELS_PERM
  },
  embed: {
    initLevel: 1,
    botPerm: EMBED_LINKS_PERM,
    userPerm: MANAGE_CHANNELS_PERM
  },
  filters: {
    initLevel: 1,
    botPerm: EMBED_LINKS_PERM,
    userPerm: MANAGE_CHANNELS_PERM
  },
  date: {
    initLevel: 1,
    botPerm: EMBED_LINKS_PERM,
    userPerm: MANAGE_CHANNELS_PERM
  },
  mention: {
    initLevel: 1,
    botPerm: EMBED_LINKS_PERM,
    userPerm: MANAGE_CHANNELS_PERM
  },
  test: {
    initLevel: 1,
    botPerm: EMBED_LINKS_PERM,
    userPerm: MANAGE_CHANNELS_PERM
  },
  sub: {
    initLevel: 1,
    botPerm: MANAGE_ROLES_OR_PERMISSIONS_PERM
  },
  unsub: {
    initLevel: 1,
    botPerm: MANAGE_ROLES_OR_PERMISSIONS_PERM
  },
  refresh: {
    initLevel: 1,
    botPerm: EMBED_LINKS_PERM,
    userPerm: MANAGE_CHANNELS_PERM
  },
  options: {
    initLevel: 1,
    botPerm: EMBED_LINKS_PERM,
    userPerm: MANAGE_CHANNELS_PERM
  },
  split: {
    initLevel: 1,
    botPerm: EMBED_LINKS_PERM,
    userPerm: MANAGE_CHANNELS_PERM
  },
  move: {
    initLevel: 1,
    userPerm: MANAGE_CHANNELS_PERM,
    botPerm: EMBED_LINKS_PERM
  },
  clone: {
    initLevel: 1,
    botPerm: EMBED_LINKS_PERM,
    userPerm: MANAGE_CHANNELS_PERM
  },
  backup: {
    initLevel: 1,
    userPerm: MANAGE_CHANNELS_PERM
  },
  dump: {
    initLevel: 1,
    botPerm: ['ATTACH_FILES', EMBED_LINKS_PERM],
    userPerm: MANAGE_CHANNELS_PERM
  },
  stats: {
    initLevel: 2,
    userPerm: MANAGE_CHANNELS_PERM
  },
  webhook: {
    initLevel: 1,
    userPerm: MANAGE_CHANNELS_PERM
  },
  prefix: {
    initLevel: 1,
    userPerm: MANAGE_CHANNELS_PERM
  },
  alert: {
    initLevel: 1,
    userPerm: MANAGE_CHANNELS_PERM
  },
  locale: {
    initLevel: 1,
    userPerm: MANAGE_CHANNELS_PERM
  },
  invite: {
    initLevel: 0,
    userPerm: MANAGE_CHANNELS_PERM
  },
  version: {
    initLevel: 0,
    userPerm: MANAGE_CHANNELS_PERM
  },
  patron: {
    initLevel: 2,
    userPerm: MANAGE_CHANNELS_PERM
  },
  compare: {
    initLevel: 2,
    userPerm: MANAGE_CHANNELS_PERM
  }
}
// Check for aliases
if (typeof config.bot.commandAliases === 'object') {
  const aliases = config.bot.commandAliases
  for (var alias in aliases) {
    const cmd = aliases[alias]
    if (cmd && list[cmd] && !list[alias]) list[alias] = { ...list[cmd], aliasFor: cmd }
  }
}

exports.list = list
exports.has = message => {
  const first = message.content.split(' ')[0]
  const prefix = storage.prefixes[message.guild.id] || config.bot.prefix
  return list.hasOwnProperty(first.substr(prefix.length))
}
exports.run = async message => {
  const log = createLogger(message.guild.shard.id)
  const bot = message.client
  const first = message.content.split(' ')[0]
  const guildPrefix = storage.prefixes[message.guild.id]
  const prefix = storage.prefixes[message.guild.id] || config.bot.prefix
  let name = first.substr(prefix.length)
  if (!list.hasOwnProperty(name)) {
    return log.error({
      guild: message.guild
    }, `Failed to run ${name} - nonexistent command`)
  }

  const cmdInfo = list[name]
  const channel = message.channel
  const guild = bot.guilds.cache.get(channel.guild.id)
  if (cmdInfo && cmdInfo.aliasFor) name = cmdInfo.aliasFor
  if (!cmdInfo) {
    return log.error({
      guild: message.guild
    }, `Could not run command "${name}" because command data does not exist`)
  }
  const botPerm = cmdInfo.botPerm
  const userPerm = cmdInfo.userPerm

  try {
    if (guildPrefix && !message.content.startsWith(guildPrefix)) {
      await message.channel.send(`Invalid command prefix. You are not using the prefix you set for your server (${guildPrefix}).`)
      return log.info({
        guild: message.guild
      }, `Ignoring command ${name} due to incorrect prefix (${prefix})`)
    } else if (!guildPrefix && !message.content.startsWith(config.bot.prefix)) {
      return
    }
    log.info({
      guild: message.guild
    }, `Used ${message.content}`)
    if (cmdInfo.initLevel !== undefined && cmdInfo.initLevel > storage.initialized) {
      const m = await message.channel.send(`This command is disabled while booting up, please wait.`)
      await m.delete({ timeout: 4000 })
    }

    // Check bot perm
    let botPermitted
    if (typeof botPerm === 'string') {
      botPermitted = PERMISSIONS.includes(botPerm) && !guild.members.cache.get(bot.user.id).permissionsIn(channel).has(botPerm)
    } else if (Array.isArray(botPerm)) {
      for (var i = 0; i < botPerm.length; ++i) {
        const thisPerm = PERMISSIONS.includes(botPerm) && !guild.members.cache.get(bot.user.id).permissionsIn(channel).has(botPerm)
        botPermitted = botPermitted === undefined ? thisPerm : botPermitted && thisPerm
      }
    }

    if (botPermitted) {
      log.info({
        guild: message.guild
      }, `Missing bot permission ${botPerm} for bot, blocked ${message.content}`)
      return await message.channel.send(`This command has been disabled due to missing bot permission \`${botPerm}\`.`)
    }

    // Check user perm
    const member = await message.guild.members.fetch(message.author)
    if (!message.member) message.member = member

    if (!userPerm || !PERMISSIONS.includes(userPerm) || config.bot.ownerIDs.includes(message.author.id)) {
      return loadCommand(name, message, name)
    }
    const serverPerm = member.permissions.has(userPerm)
    const channelPerm = member.permissionsIn(channel).has(userPerm)

    if (serverPerm || channelPerm) {
      return loadCommand(name, message, name)
    }
    log.info({
      user: message.author,
      guild: message.guild
    }, `Missing user permissions for blocked ${message.content}`)
    await message.channel.send(`You do not have the permission \`${userPerm}\` to use this command.`)
  } catch (err) {
    channelTracker.remove(message.channel.id)
    if (err.code !== 50013) {
      log.error(err, `Command ${name}`)
      message.channel.send(err.message)
        .catch(err => log.error(err, `Failed to send error message to channel for command ${name}`))
    } else {
      log.warn(err, `Command ${name} (non-50013 error)`)
    }
  }
}

exports.runOwner = async message => {
  const first = message.content.split(' ')[0]
  const prefix = storage.prefixes[message.guild.id] || config.bot.prefix
  const command = first.substr(prefix.length)
  if (!fs.existsSync(path.join(__dirname, '..', 'commands', 'owner', `${command}.js`))) {
    return
  }
  if (storage.initialized < 2) {
    return message.channel.send(`This command is disabled while booting up, please wait.`).then(m => m.delete(4000))
  }
  try {
    await loadOwnerCommand(command, message)
  } catch (err) {
    const log = createLogger(message.guild.shard.id)
    if (err.code !== 50013) {
      log.error(err, `Owner Command ${command}`)
      message.channel.send(err.message)
        .catch(err => log.error(err, `Failed to send error message to channel for command ${command}`))
    } else {
      log.warn(err, `Owner Command ${command} (non-50013 error)`)
    }
  }
}
