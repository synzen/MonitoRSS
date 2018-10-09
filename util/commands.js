const log = require('./logger.js')
const loadCommand = file => require(`../commands/${file}.js`)
const config = require('../config.json')
const storage = require('./storage.js')
const PERMISSIONS = [
  'CREATE_INSTANT_INVITE',
  'KICK_MEMBERS',
  'BAN_MEMBERS',
  'ADMINISTRATOR',
  'MANAGE_CHANNELS',
  'MANAGE_GUILD',
  'ADD_REACTIONS', // add reactions to messages
  'READ_MESSAGES',
  'SEND_MESSAGES',
  'SEND_TTS_MESSAGES',
  'MANAGE_MESSAGES',
  'EMBED_LINKS',
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
  'MANAGE_ROLES_OR_PERMISSIONS',
  'MANAGE_WEBHOOKS',
  'MANAGE_EMOJIS'
]
const list = {
  rsshelp: {
    initLevel: 0,
    userPerm: 'MANAGE_CHANNELS'
  },
  rssadd: {
    initLevel: 2,
    userPerm: 'MANAGE_CHANNELS',
    description: 'Add an RSS feed to the channel with the default message. Multiple feeds can be added by separation with `>`.',
    args: {
      '<link>': 'Feed URL.'
    }
  },
  rssremove: {
    initLevel: 2,
    botPerm: 'EMBED_LINKS',
    userPerm: 'MANAGE_CHANNELS',
    action: 'Feed Removal',
    description: 'Open a menu to delete a feed from the channel.'
  },
  rsslist: {
    initLevel: 1,
    botPerm: 'EMBED_LINKS',
    userPerm: 'MANAGE_CHANNELS',
    description: 'List all active feeds in server.'
  },
  rssmessage: {
    initLevel: 1,
    botPerm: 'EMBED_LINKS',
    userPerm: 'MANAGE_CHANNELS',
    action: 'Message Customization',
    description: "Open a menu to customize a feed's text message."
  },
  rssembed: {
    initLevel: 1,
    botPerm: 'EMBED_LINKS',
    userPerm: 'MANAGE_CHANNELS',
    args: {
      fields: 'Customize Fields for the embed.'
    },
    action: 'Embed Message Customization',
    description: "Open a menu to customzie a feed's embed message. This will replace the normal embed Discord usually sends when a link is posted."
  },
  rssfilters: {
    initLevel: 1,
    botPerm: 'EMBED_LINKS',
    userPerm: 'MANAGE_CHANNELS',
    action: 'Global Filter Addition/Removal',
    description: "Open a menu to add or remove global filters from a feed. Messages that do not have any of the words in any of your filters won't be sent to your Discord."
  },
  rssdate: {
    initLevel: 1,
    botPerm: 'EMBED_LINKS',
    userPerm: 'MANAGE_CHANNELS',
    description: 'Open a menu to customize how dates are displayed.'
  },
  rssroles: {
    initLevel: 1,
    botPerm: 'EMBED_LINKS',
    userPerm: 'MANAGE_CHANNELS',
    action: 'Role Customization',
    description: 'Open a menu to add global/filtered subscriptions for roles to feeds.'
  },
  rsstest: {
    initLevel: 1,
    botPerm: 'EMBED_LINKS',
    userPerm: 'MANAGE_CHANNELS',
    args: {
      'simple': 'Omit the test results and only send the message.'
    },
    action: 'Feed Delivery Test',
    description: 'Opens a menu to send a test message for a random article in a feed, along with the available properties and placeholders for various customizations. You may add `simple` as a parameter to exclude the test details.'
  },
  subme: {
    initLevel: 1,
    botPerm: 'MANAGE_ROLES_OR_PERMISSIONS',
    args: {
      '<role name/mention>': 'Directly input the role instead of going through the menu.'
    },
    description: "Open a menu to add a role with an active feed subscription to the user. Usable by anyone in server, enabled/disabled by \"Manage Roles\" permission. Roles *must* be below the bot's role in role order in role settings."
  },
  unsubme: {
    initLevel: 1,
    botPerm: 'MANAGE_ROLES_OR_PERMISSIONS',
    args: {
      '<role name/mention>': 'Directly input the role instead of going through the menu.'
    },
    description: "Open a menu similar to `subme`, except to remove a role. Any role beneath the bot's role order will be removeable."
  },
  rsscookies: {
    initLevel: 1,
    botPerm: 'EMBED_LINKS',
    userPerm: 'MANAGE_CHANNELS',
    action: 'Cookie Customization'
  },
  rssrefresh: {
    initLevel: 1,
    botPerm: 'EMBED_LINKS',
    userPerm: 'MANAGE_CHANNELS',
    action: 'Refresh Feed',
    description: 'Open a menu to restore the feed link back onto the regular cycle after removal due to consecutively surpassing the fail limit.'
  },
  rssoptions: {
    initLevel: 1,
    botPerm: 'EMBED_LINKS',
    userPerm: 'MANAGE_CHANNELS',
    description: 'Open a menu for miscellaneous feed options.'
  },
  rsssplit: {
    initLevel: 1,
    botPerm: 'EMBED_LINKS',
    userPerm: 'MANAGE_CHANNELS',
    action: 'Message Splitting Customization',
    description: 'Open a menu to customize message splitting settings.'
  },
  rssmove: {
    initLevel: 1,
    userPerm: 'MANAGE_CHANNELS',
    botPerm: 'EMBED_LINKS',
    description: 'Open a menu to move a feed into another channel.',
    action: 'Feed Channel Transfer'
  },
  rssclone: {
    initLevel: 1,
    botPerm: 'EMBED_LINKS',
    userPerm: 'MANAGE_CHANNELS',
    action: 'Feed Settings Cloning',
    description: "Clone a feed's settings to other feed(s).",
    args: {
      '<property>': 'Use the command without arguments for further information.'
    }
  },
  rssbackup: {
    initLevel: 1,
    userPerm: 'MANAGE_CHANNELS',
    description: 'Send server profile as a JSON attachment for personal backups.'
  },
  rssdump: {
    initLevel: 1,
    botPerm: ['ATTACH_FILES', 'EMBED_LINKS'],
    userPerm: 'MANAGE_CHANNELS',
    action: 'Raw Placeholders Dump',
    args: {
      'original': 'Output the original, untrimmed JSON form instead'
    }
  },
  rssstats: {
    initLevel: 2,
    userPerm: 'MANAGE_CHANNELS',
    description: 'Show simple stats on bot performance and size.'
  },
  rsswebhook: {
    initLevel: 1,
    userPerm: 'MANAGE_CHANNELS',
    action: 'Webhook Connection',
    description: 'Open a menu to connect a webhook to a feed to send messages instead.'
  },
  rsspatron: {
    initLevel: 2,
    userPerm: 'MANAGE_CHANNELS'
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
exports.has = name => list.hasOwnProperty(name)
exports.run = async (bot, message, name) => {
  const cmdInfo = list[name]
  if (cmdInfo.aliasFor) name = cmdInfo.aliasFor
  if (!cmdInfo) return log.command.warning(`Could not run command "${name}" because command data does not exist`)
  const botPerm = cmdInfo.botPerm
  const userPerm = cmdInfo.userPerm
  const channel = message.channel
  const guild = bot.guilds.get(channel.guild.id)

  log.command.info(`Used ${message.content}`, guild)
  try {
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

    if (!userPerm || !PERMISSIONS.includes(userPerm) || config.bot.controllerIds.includes(message.author.id)) return loadCommand(name)(bot, message, name)
    const serverPerm = member.hasPermission(userPerm)
    const channelPerm = member.permissionsIn(channel).has(userPerm)

    if (serverPerm || channelPerm) return loadCommand(name)(bot, message, name)
    log.command.warning(`Missing user permissions for blocked ${message.content}`, message.guild, message.author)
    await message.channel.send(`You do not have the permission \`${userPerm}\` to use this command.`)
  } catch (err) {
    log.command.warning('command.run', guild, err)
  }
}
