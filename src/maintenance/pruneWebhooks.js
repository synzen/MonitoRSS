const Guild = require('../structs/Guild.js')
const Supporter = require('../structs/db/Supporter.js')
const createLogger = require('../util/logger/create.js')

/**
 * @param {import('discord.js').Client} bot
 * @param {import('../structs/db/Feed.js')[]} feeds
 */
function getRelevantFeeds (bot, feeds) {
  const relevantFeeds = []
  const feedsLength = feeds.length
  for (var i = 0; i < feedsLength; ++i) {
    const feed = feeds[i]
    if (!feed.webhook) {
      continue
    }
    const channel = bot.channels.cache.get(feed.channel)
    if (!channel) {
      continue
    }
    relevantFeeds.push(feed)
  }
  return relevantFeeds
}

/**
 * @param {import('discord.js').Client} bot
 * @param {import('../structs/db/Feed.js')[]} relevantFeeds
 * @param {import('@synzen/discord-rest').RESTProducer|null} restProducer
 */
async function fetchChannelWebhooks (bot, relevantFeeds, restProducer) {
  const feedsLength = relevantFeeds.length
  const channelsToFetch = []
  for (var i = 0; i < feedsLength; ++i) {
    const feed = relevantFeeds[i]
    const channel = bot.channels.cache.get(feed.channel)
    if (!channelsToFetch.includes(channel)) {
      channelsToFetch.push(channel)
    }
  }
  const results = await Promise.allSettled(channelsToFetch.map(async c => {
    if (!restProducer) {
      return c.fetchWebhooks()
    }
    const { status, body } = await restProducer.fetch(`https://discord.com/api/channels/${c.id}/webhooks`, {
      method: 'GET'
    })
    if (!String(status).startsWith('2')) {
      // Add code field to maintain compatibility with discord.js error handling
      const error = new Error(`Bad status code (${status})`)
      error.code = body.code
      throw error
    }
    const webhooksMap = new Map()
    body.forEach(webhook => webhooksMap.set(webhook.id, webhook))
    return webhooksMap
  }))
  const map = new Map()
  for (var j = 0; j < results.length; ++j) {
    const channel = channelsToFetch[j]
    const fetchResult = results[j]
    map.set(channel.id, fetchResult)
  }
  return map
}

/**
 * @param {import('discord.js').Client} bot
 * @param {import('../structs/db/Feed.js')} feed
 * @param {Object<string, any>} webhookFetchResult
 */
function getRemoveReason (bot, feed, webhookFetchResult) {
  const { status, value: webhooks, reason } = webhookFetchResult
  const log = createLogger(bot.shard.ids[0])
  const channel = bot.channels.cache.get(feed.channel)
  let removeReason = ''
  const webhookID = feed.webhook.id
  if (status === 'fulfilled') {
    if (!webhooks.get(webhookID)) {
      removeReason = `Removing missing webhook from feed ${feed._id}`
    }
  } else {
    const err = reason
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
  return removeReason
}

async function getDisableReason (bot, feed) {
  const channel = bot.channels.cache.get(feed.channel)
  let disableReason = ''
  const guild = new Guild(channel.guild.id)
  if (Supporter.enabled && !(await guild.hasSupporterOrSubscriber())) {
    disableReason = `Disabling unauthorized supporter webhook from feed ${feed._id}`
  }
  return disableReason
}

/**
 * Precondition: The bot is sharded and no guilds
 * with missing channels remain.
 *
 * Remove all webhooks from feeds that don't exist
 * @param {import('discord.js').Client} bot
 * @param {import('../structs/db/Feed.js')[]} feeds
 * @param {import('@synzen/discord-rest').RESTProducer|null} restProducer
 * @returns {number}
 */
async function pruneWebhooks (bot, feeds, restProducer) {
  const updates = []
  const log = createLogger(bot.shard.ids[0])
  const relevantFeeds = exports.getRelevantFeeds(bot, feeds)
  const webhookFetchData = await exports.fetchChannelWebhooks(bot, relevantFeeds, restProducer)

  // Parse the fetch results
  const relevantFeedsLength = relevantFeeds.length
  const removeReasons = []
  const disableReasonsFetches = []
  for (var j = 0; j < relevantFeedsLength; ++j) {
    const feed = relevantFeeds[j]
    const webhookFetchResult = webhookFetchData.get(feed.channel)
    const removeReason = exports.getRemoveReason(bot, feed, webhookFetchResult)
    removeReasons.push(removeReason)
    if (removeReason) {
      disableReasonsFetches.push('')
    } else {
      disableReasonsFetches.push(exports.getDisableReason(bot, feed))
    }
  }
  const disableReasons = await Promise.all(disableReasonsFetches)
  for (var k = 0; k < relevantFeedsLength; ++k) {
    const feed = relevantFeeds[k]
    const removeReason = removeReasons[k]
    const disableReason = disableReasons[k]
    const channel = bot.channels.cache.get(feed.channel)
    if (removeReason) {
      log.info({
        guild: channel.guild,
        channel
      }, removeReason)
      feed.webhook = undefined
      updates.push(feed.save())
    } else {
      if (disableReason && !feed.webhook.disabled) {
        feed.webhook.disabled = true
        updates.push(feed.save())
        log.info({
          guild: channel.guild,
          channel
        }, disableReason)
      } else if (!disableReason && feed.webhook.disabled) {
        feed.webhook.disabled = undefined
        updates.push(feed.save())
        log.info({
          guild: channel.guild,
          channel
        }, 'Enabling webhook, found authorization')
      }
    }
  }
  await Promise.all(updates)
}

exports.getRelevantFeeds = getRelevantFeeds
exports.fetchChannelWebhooks = fetchChannelWebhooks
exports.getDisableReason = getDisableReason
exports.getRemoveReason = getRemoveReason
exports.pruneWebhooks = pruneWebhooks
