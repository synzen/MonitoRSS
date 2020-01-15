const fs = require('fs')
const path = require('path')
const log = require('./logger.js')
const loadCCommand = name => require(`../commands/owner/${name}.js`)
const loadCommand = file => require(`../commands/${file}.js`)
const config = require('../config.js')
const storage = require('./storage.js')
const MANAGE_CHANNELS_PERM = 'MANAGE_CHANNELS'
const EMBED_LINKS_PERM = 'EMBED_LINKS'
const MANAGE_ROLES_OR_PERMISSIONS_PERM = 'MANAGE_ROLES_OR_PERMISSIONS'

const PERMISSIONS = [
  'CREATE_INSTANT_INVITE',
  'KICK_MEMBERS',
  'BAN_MEMBERS',
  'ADMINISTRATOR',
  MANAGE_CHANNELS_PERM,
  'MANAGE_GUILD',
  'ADD_REACTIONS', // add reactions to messages
  'READ_MESSAGES',
  'SEND_MESSAGES',
  'SEND_TTS_MESSAGES',
  'MANAGE_MESSAGES',
  EMBED_LINKS_PERM,
  'ATTACH_FILES',
  'READ_MESSAGE_HISTORY',
  'MENTION_EVERYONE',
  'EXTERNAL_EMOJIS', // use external emojis
  'CONNECT', // connect to voice
  'SPEAK', // speak on voice
  'MUTE_MEMBERS', // globally mute members on voice
  'DEAFEN_MEMBERS', // globally deafen members on voice
  'MOVE_MEMBERS', // move member's voice channels
  'USE_VAD', // use voice activity detection
  'CHANGE_NICKNAME',
  'MANAGE_NICKNAMES', // change nicknames of others
  MANAGE_ROLES_OR_PERMISSIONS_PERM,
  'MANAGE_WEBHOOKS',
  'MANAGE_EMOJIS'
]
const list = {
  rsshelp: {
    initLevel: 0,
    userPerm: MANAGE_CHANNELS_PERM
  },
  rssadd: {
    initLevel: 2,
    userPerm: MANAGE_CHANNELS_PERM
  },
  rssremove: {
    initLevel: 2,
    botPerm: EMBED_LINKS_PERM,
    userPerm: MANAGE_CHANNELS_PERM
  },
  rsslist: {
    initLevel: 1,
    botPerm: EMBED_LINKS_PERM,
    userPerm: MANAGE_CHANNELS_PERM
  },
  rssmessage: {
    initLevel: 1,
    botPerm: EMBED_LINKS_PERM,
    userPerm: MANAGE_CHANNELS_PERM
  },
  rssembed: {
    initLevel: 1,
    botPerm: EMBED_LINKS_PERM,
    userPerm: MANAGE_CHANNELS_PERM
  },
  rssfilters: {
    initLevel: 1,
    botPerm: EMBED_LINKS_PERM,
    userPerm: MANAGE_CHANNELS_PERM
  },
  rssdate: {
    initLevel: 1,
    botPerm: EMBED_LINKS_PERM,
    userPerm: MANAGE_CHANNELS_PERM
  },
  rssmention: {
    initLevel: 1,
    botPerm: EMBED_LINKS_PERM,
    userPerm: MANAGE_CHANNELS_PERM
  },
  rsstest: {
    initLevel: 1,
    botPerm: EMBED_LINKS_PERM,
    userPerm: MANAGE_CHANNELS_PERM
  },
  subme: {
    initLevel: 1,
    botPerm: MANAGE_ROLES_OR_PERMISSIONS_PERM
  },
  unsubme: {
    initLevel: 1,
    botPerm: MANAGE_ROLES_OR_PERMISSIONS_PERM
  },
  rssrefresh: {
    initLevel: 1,
    botPerm: EMBED_LINKS_PERM,
    userPerm: MANAGE_CHANNELS_PERM
  },
  rssoptions: {
    initLevel: 1,
    botPerm: EMBED_LINKS_PERM,
    userPerm: MANAGE_CHANNELS_PERM
  },
  rsssplit: {
    initLevel: 1,
    botPerm: EMBED_LINKS_PERM,
    userPerm: MANAGE_CHANNELS_PERM
  },
  rssmove: {
    initLevel: 1,
    userPerm: MANAGE_CHANNELS_PERM,
    botPerm: EMBED_LINKS_PERM
  },
  rssclone: {
    initLevel: 1,
    botPerm: EMBED_LINKS_PERM,
    userPerm: MANAGE_CHANNELS_PERM
  },
  rssbackup: {
    initLevel: 1,
    userPerm: MANAGE_CHANNELS_PERM
  },
  rssdump: {
    initLevel: 1,
    botPerm: ['ATTACH_FILES', EMBED_LINKS_PERM],
    userPerm: MANAGE_CHANNELS_PERM
  },
  rssstats: {
    initLevel: 2,
    userPerm: MANAGE_CHANNELS_PERM
  },
  rsswebhook: {
    initLevel: 1,
    userPerm: MANAGE_CHANNELS_PERM
  },
  rssprefix: {
    initLevel: 1,
    userPerm: MANAGE_CHANNELS_PERM
  },
  rssalert: {
    initLevel: 1,
    userPerm: MANAGE_CHANNELS_PERM
  },
  rsslocale: {
    initLevel: 1,
    userPerm: MANAGE_CHANNELS_PERM
  },
  rssinvite: {
    initLevel: 0,
    userPerm: MANAGE_CHANNELS_PERM
  },
  rssversion: {
    initLevel: 0,
    userPerm: MANAGE_CHANNELS_PERM
  },
  rsspatron: {
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
  const bot = message.client
  const first = message.content.split(' ')[0]
  const guildPrefix = storage.prefixes[message.guild.id]
  const prefix = storage.prefixes[message.guild.id] || config.bot.prefix
  let name = first.substr(prefix.length)
  if (!list.hasOwnProperty(name)) return log.general.warning(`Failed to run ${name} - nonexistent command`, message.guild)

  const cmdInfo = list[name]
  const channel = message.channel
  const guild = bot.guilds.get(channel.guild.id)
  if (cmdInfo && cmdInfo.aliasFor) name = cmdInfo.aliasFor
  if (!cmdInfo) return log.command.warning(`Could not run command "${name}" because command data does not exist`, guild)
  const botPerm = cmdInfo.botPerm
  const userPerm = cmdInfo.userPerm

  try {
    if (guildPrefix && !message.content.startsWith(guildPrefix)) {
      await message.channel.send(`Invalid command prefix. You are not using the prefix you set for your server (${guildPrefix}).`)
      return log.command.warning(`Ignoring command ${name} due to incorrect prefix (${prefix})`, guild)
    } else if (!guildPrefix && !message.content.startsWith(config.bot.prefix)) return
    log.command.info(`Used ${message.content}`, guild)
    if (cmdInfo.initLevel !== undefined && cmdInfo.initLevel > storage.initialized) {
      const m = await message.channel.send(`This command is disabled while booting up, please wait.`)
      await m.delete(4000)
    }

    // Check bot perm
    let botPermitted
    if (typeof botPerm === 'string') botPermitted = PERMISSIONS.includes(botPerm) && !guild.members.get(bot.user.id).permissionsIn(channel).has(botPerm)
    else if (Array.isArray(botPerm)) {
      for (var i = 0; i < botPerm.length; ++i) {
        const thisPerm = PERMISSIONS.includes(botPerm) && !guild.members.get(bot.user.id).permissionsIn(channel).has(botPerm)
        botPermitted = botPermitted === undefined ? thisPerm : botPermitted && thisPerm
      }
    }

    if (botPermitted) {
      log.command.warning(`Missing bot permission ${botPerm} for bot, blocked ${message.content}`, guild)
      return await message.channel.send(`This command has been disabled due to missing bot permission \`${botPerm}\`.`)
    }

    // Check user perm
    const member = await message.guild.fetchMember(message.author)
    if (!message.member) message.member = member

    if (!userPerm || !PERMISSIONS.includes(userPerm) || config.bot.ownerIDs.includes(message.author.id)) return loadCommand(name)(bot, message, name)
    const serverPerm = member.hasPermission(userPerm)
    const channelPerm = member.permissionsIn(channel).has(userPerm)

    if (serverPerm || channelPerm) return loadCommand(name)(bot, message, name)
    log.command.warning(`Missing user permissions for blocked ${message.content}`, message.guild, message.author)
    await message.channel.send(`You do not have the permission \`${userPerm}\` to use this command.`)
  } catch (err) {
    log.command.warning('command.run', guild, err)
  }
}

exports.runOwner = message => {
  const bot = message.client
  const first = message.content.split(' ')[0]
  const prefix = storage.prefixes[message.guild.id] || config.bot.prefix
  const command = first.substr(prefix.length)
  if (fs.existsSync(path.join(__dirname, '..', 'commands', 'owner', `${command}.js`))) {
    if (storage.initialized < 2) return message.channel.send(`This command is disabled while booting up, please wait.`).then(m => m.delete(4000))
    loadCCommand(command)(bot, message)
  }
}
