const validPerms = [
  "CREATE_INSTANT_INVITE",
  "KICK_MEMBERS",
  "BAN_MEMBERS",
  "ADMINISTRATOR",
  "MANAGE_CHANNELS",
  "MANAGE_GUILD",
  "ADD_REACTIONS", // add reactions to messages
  "READ_MESSAGES",
  "SEND_MESSAGES",
  "SEND_TTS_MESSAGES",
  "MANAGE_MESSAGES",
  "EMBED_LINKS",
  "ATTACH_FILES",
  "READ_MESSAGE_HISTORY",
  "MENTION_EVERYONE",
  "EXTERNAL_EMOJIS", // use external emojis
  "CONNECT", // connect to voice
  "SPEAK", // speak on voice
  "MUTE_MEMBERS", // globally mute members on voice
  "DEAFEN_MEMBERS", // globally deafen members on voice
  "MOVE_MEMBERS", // move member's voice channels
  "USE_VAD", // use voice activity detection
  "CHANGE_NICKNAME",
  "MANAGE_NICKNAMES", // change nicknames of others
  "MANAGE_ROLES_OR_PERMISSIONS",
  "MANAGE_WEBHOOKS",
  "MANAGE_EMOJIS"
]

module.exports = function (bot, message, permission) {
  if (!permission || !validPerms.includes(permission)) return true;
  let channel = message.channel
  let guild = bot.guilds.get(channel.guild.id)
  let guildBot = guild.members.get(bot.user.id)

  let hasPerm = guildBot.permissionsIn(channel).hasPermission(permission);

  if (permission === 'MANAGE_ROLES_OR_PERMISSIONS' && !hasPerm) console.log(`Commands Warning: (${channel.guild.id}, ${channel.guild.nane}) => Self subscription disabled due to missing permission.`);

  return hasPerm;

}
