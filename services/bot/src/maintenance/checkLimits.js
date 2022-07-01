const Guild = require('../structs/Guild.js')
const createLogger = require('../util/logger/create.js')
const getConfig = require('../config.js').get
const log = createLogger()

/**
 * Enable or disable feeds for guilds past their limit
 * @param {import('../structs/db/Feed.js')[]} feeds
 * @returns {Object<string, import('../structs/db/Feed.js')[]>} object
 * @returns {import('../structs/db/Feed.js')[]} object.enabled - Number of enabled feeds
 * @returns {import('../structs/db/Feed.js')[]} object.disabled - Number of disabled feeds
 */
async function checkLimits (feeds) {
  const supporterLimits = await Guild.getAllUniqueFeedLimits()
  const config = getConfig()
  const feedCounts = new Map()
  const enabled = []
  const disabled = []
  const length = feeds.length
  for (var i = 0; i < length; ++i) {
    const feed = feeds[i]
    const guild = feed.guild
    const supporterLimit = supporterLimits.get(guild)
    const guildLimit = supporterLimit !== undefined
      ? supporterLimit
      : config._vipRestricted === true
        ? -1 // If vip restricted, every non-supporter should have 0 feeds
        : config.feeds.max
    let feedCount = feedCounts.get(guild) || 0

    // Ignore all unrelated disabled feeds and don't count them
    if (feed.disabled && feed.disabled !== 'Exceeded feed limit') {
      continue
    }

    // If the limit is 0 and the feed exceeded limit, enable it
    if (guildLimit === 0) {
      if (feed.disabled) {
        log.info(`Enabling disabled feed ${feed._id} of guild ${feed.guild} due to no set limit`)
        enabled.push(feed.enable())
      }
      continue
    }

    /**
     * Two cases:
     * 1. Disabled feed whose reason is exceeded feed limit
     * 2. Enabled feed
     */

    if (feed.disabled) {
      if (feedCount < guildLimit) {
        // Enable it
        feedCount = feedCount + 1
        feedCounts.set(guild, feedCount)
        log.info(`Enabling disabled feed ${feed._id} of guild ${feed.guild} due to limit change`)
        enabled.push(feed.enable())
      }
      // Otherwise, don't count it
    } else {
      if (feedCount + 1 > guildLimit) {
        // Disable it if adding the current one goes over limit
        log.info(`Disabling enabled feed ${feed._id} of guild ${feed.guild} due to limit change`)
        disabled.push(feed.disable('Exceeded feed limit'))
      } else {
        // Otherwise, just count it
        feedCount = feedCount + 1
        feedCounts.set(guild, feedCount)
      }
    }
  }
  const results = await Promise.all([
    Promise.all(disabled),
    Promise.all(enabled)
  ])
  return {
    disabled: results[0],
    enabled: results[1]
  }
}

exports.limits = checkLimits
