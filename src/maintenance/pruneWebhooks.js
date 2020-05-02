const Supporter = require('../structs/db/Supporter.js')
const createLogger = require('../util/logger/create.js')

/**
 * Precondition: The bot is sharded and no guilds
 * with missing channels remain.
 *
 * Remove all webhooks from feeds that don't exist
 * @param {import('discord.js').Client} bot
 * @param {import('../structs/db/Feed.js')} feeds
 * @returns {number}
 */
async function pruneWebhooks (bot, feeds) {
  const log = createLogger(bot.shard.ids[0])
  /** @type {Map<string, Feed>} */
  const updates = []
  const length = feeds.length
  for (var i = length - 1; i >= 0; --i) {
    const feed = feeds[i]
    if (!feed.webhook) {
      continue
    }
    const webhookID = feed.webhook.id
    const channelID = feed.channel
    const channel = bot.channels.cache.get(channelID)
    if (!channel) {
      continue
    }

    try {
      const webhooks = await channel.fetchWebhooks()
      if (!webhooks.get(webhookID)) {
        log.info({
          guild: channel.guild,
          channel
        }, `Removing missing webhook from feed ${feed._id}`)
        feed.webhook = undefined
        updates.push(feed.save())
      }
    } catch (err) {
      log.warn({
        guild: channel.guild,
        channel,
        error: err
      }, `Unable to check webhook (request error, code ${err.code})`)
    }

    // Check supporter
    if (Supporter.enabled && feed.webhook && !(await Supporter.hasValidGuild(channel.guild.id))) {
      log.info({
        guild: channel.guild
      }, `Removing unauthorized webhook from feed ${feed._id}`)
      feed.webhook = undefined
      updates.push(feed.save())
    }
  }
  await Promise.all(updates)
}

module.exports = pruneWebhooks
