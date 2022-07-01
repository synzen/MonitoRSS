/**
 * @param {import('discord.js').Guild} guild
 */
function guild (guild) {
  if (!guild) {
    return guild
  }
  return `${guild.id}, ${guild.name}`
}

/**
* @param {import('discord.js').TextChannel} channel
*/
function channel (channel) {
  if (!channel) {
    return channel
  }
  return `${channel.id}, ${channel.name}`
}

/**
* @param {import('discord.js').User} user
*/
function user (user) {
  if (!user) {
    return user
  }
  return `${user.id}, ${user.username}`
}

/**
 * @param {import('discord.js').Message} message
 */
function message (message) {
  if (!message) {
    return message
  }
  return `${message.content}`
}

/**
 * @param {import('../../structs/db/Feed')} feed
 */
function feed (feed) {
  if (!feed) {
    return feed
  }
  return `${feed._id}`
}

module.exports = {
  guild,
  channel,
  user,
  message,
  feed
}
