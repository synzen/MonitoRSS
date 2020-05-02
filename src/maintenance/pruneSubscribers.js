const Subscriber = require('../structs/db/Subscriber.js')
const createLogger = require('../util/logger/create.js')

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
      try {
        await guild.members.fetch(subscriber.id)
      } catch (err) {
        if (err.code === 10013 || err.code === 10007) {
          log.info(`Deleting missing user subscriber ${subscriber._id} of feed ${feed._id} of guild ${feed.guild}`)
          deletions.push(subscriber.delete())
        }
      }
    } else if (subscriber.type === Subscriber.TYPES.ROLE) {
      try {
        await guild.roles.fetch(subscriber.id)
      } catch (err) {
        if (err.code === 10011) {
          log.info(`Deleting missing role subscriber ${subscriber._id} of feed ${feed._id} of guild ${feed.guild}`)
          deletions.push(subscriber.delete())
        }
      }
    }
  }
  await Promise.all(deletions)
  return deletions.length
}

module.exports = pruneSubscribers
