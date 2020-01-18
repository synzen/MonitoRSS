const log = require('../logger.js')

/**
 * Precondition: The feed's guild belongs to the bot, or the
 * shard if it is sharded.
 * @param {import('../../structs/db/Feed.js')} feed - The feed
 * @param {import('../../structs/db/Format.js')} format - The feed's format
 * @param {import('discord.js').Client} bot
 * @returns {boolean} - The feed's disabled status
 */
async function checkPermissions (feed, format, bot) {
  if (feed.disabled && !feed.disabled.startsWith('Missing permissions')) {
    // The feed is disabled for a separate reason - skip all checks
    return true
  }
  const channel = bot.channels.get(feed.channel)
  const guild = channel.guild
  const permissions = guild.me.permissionsIn(channel)
  const allowView = permissions.has('VIEW_CHANNEL')
  const allowSendMessages = permissions.has('SEND_MESSAGES')
  const allowEmbedLinks = !format || format.embeds.length === 0 ? true : permissions.has('EMBED_LINKS')
  if (!allowSendMessages || !allowEmbedLinks || !allowView) {
    let reasons = []
    if (!allowSendMessages) reasons.push('SEND_MESSAGES')
    if (!allowEmbedLinks) reasons.push('EMBED_LINKS')
    if (!allowView) reasons.push('VIEW_CHANNEL')
    const reason = `Missing permissions ${reasons.join(', ')}`
    if (!feed.disabled) {
      log.general.info(`Disabling feed ${feed._id} (${reason})`, guild, channel)
      await feed.disable(reason)
    } else if (feed.disabled.startsWith('Missing permissions') && feed.disabled !== reason) {
      log.general.info(`Updating disabled feed ${feed._id} (${reason})`, guild, channel)
      await feed.disable(reason)
    }
    return true
  } else if (feed.disabled && feed.disabled.startsWith('Missing permissions')) {
    log.general.info(`Enabling feed ${feed._id} for found permissions`, guild, channel)
    await feed.enable()
    return false
  }
  return !!feed.disabled
}

module.exports = checkPermissions
