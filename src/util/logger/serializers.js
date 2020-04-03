/**
 * @param {import('discord.js').Guild} guild
 */
function guild (guild) {
  return `${guild.id}, ${guild.name}`
}

/**
* @param {import('discord.js').TextChannel} channel
*/
function channel (channel) {
  return `${channel.id}, ${channel.name}`
}

/**
* @param {import('discord.js').User} user
*/
function user (user) {
  return `${user.id}, ${user.username}`
}

/**
 * @param {import('discord.js').Message} message
 */
function message (message) {
  return `${message.content}`
}

module.exports = {
  guild,
  channel,
  user,
  message
}
