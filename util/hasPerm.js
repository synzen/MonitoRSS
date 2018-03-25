const log = require('./logger.js')
const config = require('../config.json')

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

exports.bot = (bot, message, permission) => {
  if (!permission || !PERMISSIONS.includes(permission)) return true
  const channel = message.channel
  const guild = bot.guilds.get(channel.guild.id)
  const guildBot = guild.members.get(bot.user.id)
  const hasPerm = guildBot.permissionsIn(channel).has(permission)

  if (permission === 'MANAGE_ROLES_OR_PERMISSIONS' && !hasPerm) {
    log.command.warning(`Self subscription disabled due to missing "Manage Roles" permission`, message.guild)
    message.channel.send('Function disabled due to missing `Manage Roles` permission.').then(m => m.delete(3000)).catch(err => log.command.warning(`hasperm 1`, message.guild, err))
  } else if (permission === 'EMBED_LINKS' && !hasPerm) {
    log.command.warning(`Menu commands disabled due to missing "Embed Links" permission`, message.guild)
    message.channel.send('Menu commands disabled due to missing `Embed Links` permission.').then(m => m.delete(3000)).catch(err => log.command.warning(`hasperm 2`, message.guild, err))
  } else if (!hasPerm) {
    log.command.warning(`Missing permissions for user, blocked ${message.content}`, message.guild, message.author)
  }

  return hasPerm
}

exports.user = (message, permission) => {
  if (!permission || !PERMISSIONS.includes(permission) || config.bot.controllerIds.includes(message.author.id)) return true

  const serverPerm = message.member.hasPermission(permission)
  const channelPerm = message.member.permissionsIn(message.channel).has(permission)

  if (serverPerm || channelPerm) return true
  else {
    log.command.warning(`Missing permissions for user, blocked ${message.content}`, message.guild, message.author)
    return false
  }
}
