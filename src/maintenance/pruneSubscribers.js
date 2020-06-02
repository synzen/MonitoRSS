const Subscriber = require('../structs/db/Subscriber.js')
const createLogger = require('../util/logger/create.js')
const MISSING_CODES = new Set([10011, 10013, 10007])

/**
 * @typedef {Object} SubscriberDetails
 * @property {import('discord.js').Guild} guild
 * @property {import('../structs/db/Subscriber.js')} subscriber
 */

/**
 * @param {import('discord.js').Client} bot
 * @param {SubscriberDetails[]} subscribersDetails
 */
async function fetchSubscribers (subscribersDetails) {
  const idsToFetch = new Set()
  for (var i = subscribersDetails.length - 1; i >= 0; --i) {
    const { subscriber } = subscribersDetails[i]
    idsToFetch.add(subscriber.id)
  }
  const ids = []
  const fetches = []
  for (var j = subscribersDetails.length - 1; j >= 0; --j) {
    const { subscriber, guild } = subscribersDetails[j]
    if (!idsToFetch.has(subscriber.id)) {
      continue
    }
    ids.push(subscriber.id)
    fetches.push(guild.members.fetch(subscriber.id))
    idsToFetch.delete(subscriber.id)
  }
  const results = await Promise.allSettled(fetches)
  const returnData = new Map()
  for (var k = results.length - 1; k >= 0; --k) {
    const id = ids[k]
    const result = results[k]
    returnData.set(id, result)
  }
  return returnData
}

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
  for (var i = feeds.length - 1; i >= 0; --i) {
    const feed = feeds[i]
    feedsById.set(feed._id, feed)
  }
  const deletions = []
  const relevantSubscribers = []
  for (var j = subscribers.length - 1; j >= 0; --j) {
    const subscriber = subscribers[j]
    const feed = feedsById.get(subscriber.feed)
    if (!feed) {
      continue
    }
    const guild = bot.guilds.cache.get(feed.guild)
    if (subscriber.type === Subscriber.TYPES.ROLE) {
      if (!guild.roles.cache.has(subscriber.id)) {
        log.info(`Deleting missing role subscriber ${subscriber._id} of feed ${subscriber.feed}`)
        deletions.push(subscriber.delete())
      }
    } else if (subscriber.type === Subscriber.TYPES.USER) {
      relevantSubscribers.push({
        guild,
        subscriber
      })
    } else {
      log.info(`Deleting invalid ${subscriber.type} subscriber ${subscriber._id} of feed ${feed._id} of guild ${feed.guild}`)
      deletions.push(subscriber.delete())
    }
  }
  const results = await exports.fetchSubscribers(relevantSubscribers)
  const brokenSubscribers = new Set()
  results.forEach((result, subscriberID) => {
    if (result.status === 'rejected' && MISSING_CODES.has(result.reason.code)) {
      brokenSubscribers.add(subscriberID)
    }
  })
  for (var k = subscribers.length - 1; k >= 0; --k) {
    const subscriber = subscribers[k]
    if (brokenSubscribers.has(subscriber.id)) {
      log.info(`Deleting missing user subscriber ${subscriber._id} of feed ${subscriber.feed}`)
      deletions.push(subscriber.delete())
    }
  }

  await Promise.all(deletions)
  return deletions.length
}

exports.fetchSubscribers = fetchSubscribers
exports.pruneSubscribers = pruneSubscribers
