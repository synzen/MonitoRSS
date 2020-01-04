const Subscriber = require('../../structs/db/Subscriber.js')
const Feed = require('../../structs/db/Feed.js')

/**
 * Precondition: Feeds have been pruned, and thus no feeds
 * with missing guilds remain.
 *
 * 1. Remove all subscribers whose feed doesn't exist
 * 2. Remove all subscribers that don't exist in Discord
 * @param {import('discord.js').Client} bot
 * @returns {number}
 */
async function pruneSubscribers (bot) {
  const sharded = bot.shard && bot.shard.count > 0
  const [ subscribers, feeds ] = await Promise.all([
    Subscriber.getAll(),
    Feed.getAll()
  ])
  /** @type {Map<string, Feed>} */
  const feedsById = new Map()
  for (const feed of feeds) {
    feedsById.set(feed._id, feed)
  }
  const deletions = []
  for (const subscriber of subscribers) {
    const feed = feedsById.get(subscriber.feed)
    if (!feed) {
      deletions.push(subscriber.delete())
      continue
    }
    const guild = bot.guilds.get(feed.guild)
    /**
     * If sharded, skip if this bot does not have this guild
     */
    if (sharded && !guild) {
      continue
    }
    /**
     * In this case, the bot is unsharded and if it doesn't exist,
     * then the subscriber should be deleted.
     */
    if (!guild) {
      deletions.push(subscriber.delete())
    } else if (subscriber.type === Subscriber.TYPES.USER && !bot.users.has(subscriber.id)) {
      deletions.push(subscriber.delete())
    } else if (subscriber.type === Subscriber.TYPES.ROLE && !guild.roles.has(subscriber.id)) {
      deletions.push(subscriber.delete())
    }
  }
  await Promise.all(deletions)
  return deletions.length
}

module.exports = pruneSubscribers
