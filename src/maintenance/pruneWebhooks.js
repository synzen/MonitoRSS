const Feed = require('../structs/db/Feed.js')
const createLogger = require('../util/logger/create.js')

/**
 * Precondition: The bot is sharded and no guilds
 * with missing channels remain.
 *
 * Remove all webhooks from feeds that don't exist
 * @param {import('discord.js').Client} bot
 * @returns {number}
 */
async function pruneWebhooks (bot) {
  const log = createLogger(bot.shard.ids[0])
  const feeds = await Feed.getAll()
  /** @type {Map<string, Feed>} */
  const updates = []
  const length = feeds.length
  for (var i = 0; i < length; ++i) {
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

    const webhooks = await channel.fetchWebhooks()
    if (!webhooks.get(webhookID)) {
      log.info({
        guild: channel.guild
      }, `Removing missing webhook from feed ${feed._id}`)
      feed.webhook = undefined
      updates.push(feed.save())
    }
  }
  await Promise.all(updates)
}

module.exports = pruneWebhooks
