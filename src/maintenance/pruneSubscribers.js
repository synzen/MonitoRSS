const Subscriber = require('../structs/db/Subscriber.js')
const createLogger = require('../util/logger/create.js')
const MISSING_CODES = [10011, 10013, 10007]

/**
 * Precondition: Feeds have been pruned, and thus no feeds
 * with missing guilds remain. The bot is also sharded.
 *
 * 1. Remove all subscribers whose feed doesn't exist
 * 2. Remove all subscribers that don't exist in Discord
 * @param {import('discord.js').Client} bot
 * @param {import('../structs/db/Feed.js')[]} feeds
 * @returns {number}
 */
async function pruneSubscribers (bot, feeds) {
  const log = createLogger(bot.shard.ids[0])
  const subscribers = await Subscriber.getAll()
  /** @type {Map<string, import('../structs/db/Feed.js')>} */
  const feedsById = new Map()
  const feedsLength = feeds.length
  for (var i = feedsLength - 1; i >= 0; --i) {
    const feed = feeds[i]
    feedsById.set(feed._id, feed)
  }
  const deletions = []
  const subscribersLength = subscribers.length
  const relevantSubscribers = []
  const relevantFetches = []
  for (var j = subscribersLength - 1; j >= 0; --j) {
    const subscriber = subscribers[j]
    const feed = feedsById.get(subscriber.feed)
    if (!feed) {
      deletions.push(subscriber.delete())
      continue
    }
    /** @type {import('discord.js').Guild} */
    const guild = bot.guilds.cache.get(feed.guild)
    /**
     * If sharded, skip if this bot does not have this guild
     */
    if (!guild) {
      continue
    }

    if (subscriber.type === Subscriber.TYPES.USER) {
      relevantSubscribers.push(subscriber)
      relevantFetches.push(guild.members.fetch(subscriber.id))
    } else if (subscriber.type === Subscriber.TYPES.ROLE) {
      relevantSubscribers.push(subscriber)
      relevantFetches.push(guild.roles.fetch(subscriber.id))
    }
  }

  const completedFetches = await Promise.allSettled(relevantFetches)
  const fetchesLength = completedFetches.length
  for (var k = 0; k < fetchesLength; ++k) {
    const subscriber = relevantSubscribers[k]
    const feed = feedsById.get(subscriber.feed)
    const result = completedFetches[k]
    if (result.status === 'rejected' && MISSING_CODES.includes(result.reason.code)) {
      log.info(`Deleting missing ${subscriber.type} subscriber ${subscriber._id} of feed ${feed._id} of guild ${feed.guild}`)
      deletions.push(subscriber.delete())
    }
  }

  await Promise.all(deletions)
  return deletions.length
}

module.exports = pruneSubscribers
