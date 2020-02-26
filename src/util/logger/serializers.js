/**
 * @param {import('discord.js').Guild} guild
 */
function guild (guild) {
  return `${guild.id}, ${guild.name}`
}

/**
* @param {import('discord.js').TextChannel} channel
*/
function textChannel (channel) {
  return `(${channel.guild.id}) ${channel.id}, ${channel.name}`
}

/**
* @param {import('discord.js').User} user
*/
function user (user) {
  return `${user.id}, ${user.username}`
}

module.exports = {
  guild,
  textChannel,
  user
}
