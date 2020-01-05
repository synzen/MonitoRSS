const config = require('../../config.js')

/**
 * Enable or disable feeds for guilds past their limit
 * @param {import('../../structs/db/Feed.js')[]} feeds
 * @param {Map<string, number>} supporterLimits
 * @returns {Object<string, number>} object
 * @returns {number} object.enabled - Number of enabled feeds
 * @returns {number} object.disabled - Number of disabled feeds
 */
async function checkLimits (feeds, supporterLimits) {
  const feedCounts = new Map()
  const enabled = []
  const disabled = []
  for (const feed of feeds) {
    const guild = feed.guild
    const supporterLimit = supporterLimits.get(guild)
    const guildLimit = supporterLimit === undefined ? config.feeds.max : supporterLimit
    let feedCount = feedCounts.get(guild)

    // If 0, enable everything
    if (guildLimit === 0) {
      if (feed.disabled) {
        enabled.push(feed.enable())
      }
      continue
    }

    // Otherwise, count the feeds for each guild
    if (feedCount === undefined) {
      feedCounts.set(guild, 1)
    } else {
      ++feedCount
      feedCounts.set(guild, feedCount)
    }

    // And check if they should be enabled or disabled
    if (feedCount > guildLimit) {
      if (!feed.disabled) {
        disabled.push(feed.disable('Exceeded feed limit'))
        feedCounts.set(guild, feedCount - 1)
      }
    } else if (feed.disabled === 'Exceeded feed limit') {
      enabled.push(feed.enable())
      feedCounts.set(guild, feedCount + 1)
    }
  }
  await Promise.all([ disabled, enabled ])
  return {
    enabled: enabled.length,
    disabled: disabled.length
  }
}

module.exports = checkLimits
