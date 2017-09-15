const validPerms = [
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

exports.bot = function (bot, message, permission) {
  if (!permission || !validPerms.includes(permission)) return true
  const channel = message.channel
  const guild = bot.guilds.get(channel.guild.id)
  const guildBot = guild.members.get(bot.user.id)
  const hasPerm = guildBot.permissionsIn(channel).has(permission)

  if (permission === 'MANAGE_ROLES_OR_PERMISSIONS' && !hasPerm) {
    console.log(`Commands Warning: (${channel.guild.id}, ${channel.guild.name}) => Self subscription disabled due to missing permission.`)
    message.channel.send('Function disabled due to missing `Manage Roles` permission.').then(m => m.delete(3000))
  }

  return hasPerm
}

exports.user = function (message, permission) {
  if (!permission || !validPerms.includes(permission)) return true

  const serverPerm = message.member.hasPermission(permission)
  const channelPerm = message.member.permissionsIn(message.channel).has(permission)

  if (serverPerm || channelPerm) return true
  else return false
}
