const createLogger = require('../util/logger/create.js')
const ipc = require('../util/ipc.js')
const getConfig = require('../config.js').get
const log = createLogger()

/**
 * Enable or disable feeds for guilds past their limit
 * @param {import('../../structs/db/Feed.js')[]} feeds
 * @param {Map<string, number>} supporterLimits
 * @returns {Object<string, number>} object
 * @returns {number} object.enabled - Number of enabled feeds
 * @returns {number} object.disabled - Number of disabled feeds
 */
async function checkLimits (feeds, supporterLimits) {
  const config = getConfig()
  const feedCounts = new Map()
  const enabled = []
  const disabled = []
  const length = feeds.length
  for (var i = 0; i < length; ++i) {
    const feed = feeds[i]
    const guild = feed.guild
    const supporterLimit = supporterLimits.get(guild)
    const guildLimit = supporterLimit === undefined ? config.feeds.max : supporterLimit
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
        ipc.sendUserAlert(feed.channel, `Feed <${feed.url}> has been enabled in <#${feed.channel}> to due limit changes.`)
        enabled.push(feed.enable())
      }
      // Otherwise, don't count it
    } else {
      if (feedCount + 1 > guildLimit) {
        // Disable it if adding the current one goes over limit
        log.info(`Disabling enabled feed ${feed._id} of guild ${feed.guild} due to limit change`)
        ipc.sendUserAlert(feed.channel, `Feed <${feed.url}> has been disabled in <#${feed.channel}> to due limit changes.`)
        disabled.push(feed.disable('Exceeded feed limit'))
      } else {
        // Otherwise, just count it
        feedCount = feedCount + 1
        feedCounts.set(guild, feedCount)
      }
    }
  }
  await Promise.all([
    Promise.all(disabled),
    Promise.all(enabled)
  ])
  return {
    enabled: enabled.length,
    disabled: disabled.length
  }
}

module.exports = checkLimits
