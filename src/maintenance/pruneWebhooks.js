const Supporter = require('../structs/db/Supporter.js')
const createLogger = require('../util/logger/create.js')

/**
 * Precondition: The bot is sharded and no guilds
 * with missing channels remain.
 *
 * Remove all webhooks from feeds that don't exist
 * @param {import('discord.js').Client} bot
 * @param {import('../structs/db/Feed.js')[]} feeds
 * @returns {number}
 */
async function pruneWebhooks (bot, feeds) {
  const log = createLogger(bot.shard.ids[0])
  /** @type {Map<string, Feed>} */
  const updates = []
  const relevantFeeds = []
  const relevantChannels = []
  // Optimize webhook fetches
  for (var i = feeds.length - 1; i >= 0; --i) {
    const feed = feeds[i]
    if (!feed.webhook) {
      continue
    }
    const channel = bot.channels.cache.get(feed.channel)
    if (!channel) {
      continue
    }
    relevantFeeds.push(feed)
    relevantChannels.push(channel)
  }
  const webhooksFetchResults = await Promise.allSettled(relevantChannels.map(c => c.fetchWebhooks()))

  // Parse the fetch results
  const fetchesLength = webhooksFetchResults.length
  for (var j = 0; j < fetchesLength; ++j) {
    const feed = relevantFeeds[j]
    const webhookFetchResult = webhooksFetchResults[j]
    const webhookID = feed.webhook.id
    const channel = relevantChannels[j]
    let removeReason = ''
    if (webhookFetchResult.status === 'fulfilled') {
      const webhooks = webhookFetchResult.value
      if (!webhooks.get(webhookID)) {
        removeReason = `Removing missing webhook from feed ${feed._id}`
      }
    } else {
      const err = webhookFetchResult.reason
      if (err.code === 50013) {
        removeReason = `Removing unpermitted webhook from feed ${feed._id}`
      } else {
        log.warn({
          guild: channel.guild,
          channel,
          error: err
        }, `Unable to check webhook (request error, code ${err.code})`)
      }
    }

    // Check supporter
    if (!removeReason && Supporter.enabled && !(await Supporter.hasValidGuild(channel.guild.id))) {
      removeReason = `Removing unauthorized supporter webhook from feed ${feed._id}`
    }

    if (removeReason) {
      log.info({
        guild: channel.guild,
        channel
      }, removeReason)
      feed.webhook = undefined
      updates.push(feed.save())
    }
  }
  await Promise.all(updates)
}

module.exports = pruneWebhooks
