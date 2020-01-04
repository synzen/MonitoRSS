const Feed = require('../../structs/db/Feed.js')
const Supporter = require('../../structs/db/Supporter.js')
const config = require('../../config.js')

/**
 * Enable or disable feeds for guilds past their limit
 * @returns {Object<string, number>} object
 * @returns {number} object.enabled - Number of enabled feeds
 * @returns {number} object.disabled - Number of disabled feeds
 */

async function checkLimits () {
  const [ feeds, supporterLimits ] = await Promise.all([
    Feed.getAll(),
    Supporter.getFeedLimitsOfGuilds()
  ])
  const feedCounts = new Map()
  const enabled = []
  const disabled = []
  for (const feed of feeds) {
    const guild = feed.guild
    const guildLimit = supporterLimits.get(guild) || config.feeds.max
    let feedCount = feedCounts.get(guild)
    if (feedCount === undefined) {
      feedCounts.set(guild, 1)
    } else {
      ++feedCount
      feedCounts.set(guild, feedCount)
    }
    if (feedCount > guildLimit) {
      if (!feed.disabled) {
        disabled.push(feed.disable('Exceeded feed limit'))
      }
    } else if (feed.disabled) {
      enabled.push(feed.enable())
    }
  }
  await Promise.all([ disabled, enabled ])
  return {
    enabled: enabled.length,
    disabled: disabled.length
  }
}

module.exports = checkLimits
