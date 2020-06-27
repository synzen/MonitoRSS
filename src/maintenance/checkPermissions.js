const FLAGS = require('discord.js').Permissions.FLAGS
const createLogger = require('../util/logger/create.js')

/**
 * Precondition: The feed's guild belongs to the bot, or the
 * shard if it is sharded. Webhooks have been pruned.
 *
 * @param {import('../../structs/db/Feed.js')} feed - The feed
 * @param {import('discord.js').Client} bot
 * @returns {Promise<boolean>} - The feed's disabled status
 */
async function feed (feed, bot) {
  const log = createLogger(bot.shard.ids[0])
  if (feed.disabled && !feed.disabled.startsWith('Missing permissions')) {
    // The feed is disabled for a separate reason - skip all checks
    return true
  }
  if (feed.webhook) {
    return false
  }
  const channel = bot.channels.cache.get(feed.channel)
  const guild = channel.guild
  const permissions = guild.me.permissionsIn(channel)
  const allowView = permissions.has(FLAGS.VIEW_CHANNEL)
  const allowSendMessages = permissions.has(FLAGS.SEND_MESSAGES)
  const allowEmbedLinks = feed.embeds.length === 0 ? true : permissions.has(FLAGS.EMBED_LINKS)
  if (!allowSendMessages || !allowEmbedLinks || !allowView) {
    const reasons = []
    if (!allowSendMessages) {
      reasons.push('SEND_MESSAGES')
    }
    if (!allowEmbedLinks) {
      reasons.push('EMBED_LINKS')
    }
    if (!allowView) {
      reasons.push('VIEW_CHANNEL')
    }
    const reason = `Missing permissions ${reasons.join(', ')}`
    if (!feed.disabled) {
      // ipc.sendUserAlert(channel.id, `The feed <${feed.url}> has been disabled in channel <#${channel.id}>: ${reason}`)
      log.info({
        guild,
        channel
      }, `Disabling feed ${feed._id} (${reason})`)
      await feed.disable(reason)
    } else if (feed.disabled.startsWith('Missing permissions') && feed.disabled !== reason) {
      log.info({
        guild,
        channel
      }, `Updating disabled feed ${feed._id} (${reason})`)
      await feed.disable(reason)
    }
    return true
  } else if (feed.disabled && feed.disabled.startsWith('Missing permissions')) {
    log.info({
      guild,
      channel
    }, `Enabling feed ${feed._id} for found permissions`)
    // ipc.sendUserAlert(channel.id, `The feed <${feed.url}> has been enabled in channel <#${channel.id}> due to found permissions.`)
    await feed.enable()
    return false
  }
  return !!feed.disabled
}

/**
 * Checks the permissions of all feeds.
 * @param {import('discord.js').Client} bot
 * @param {import('../structs/db/Feed.js')[]} feeds
 */
async function feeds (bot, feeds) {
  const length = feeds.length
  const promises = []
  for (var i = length - 1; i >= 0; --i) {
    const feed = feeds[i]
    const channelID = feed.channel
    const hasChannel = bot.channels.cache.has(channelID)

    // Skip channels that don't belong to this shard
    if (!hasChannel) {
      continue
    }

    promises.push(exports.feed(feed, bot))
  }
  await Promise.all(promises)
}

exports.feed = feed
exports.feeds = feeds
