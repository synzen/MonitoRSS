const commonPrompts = require('../common/index.js')
const LocalizedPrompt = require('../common/utils/LocalizedPrompt.js')

/**
 * @typedef {Object} Data
 * @property {import('../../../structs/db/Profile.js')} [profile]
 * @property {import('../../../structs/db/Feed.js')[]} feeds
 * @property {import('../../../structs/db/Subscriber.js')[]} subscribers
 */

/**
 * @param {import('../../../structs/db/Feed.js')[]} feeds
 * @param {import('../../../structs/db/Subscriber.js')[]} subscribers
 */
function getRelevantFeeds (subscribers, feeds) {
  const subscribedFeedIDs = new Set(subscribers.map(s => s.feed))
  const relevantFeeds = feeds.filter(f => subscribedFeedIDs.has(f._id))
  return relevantFeeds
}

/**
 * @param {Data} data
 */
function selectFeedVisual (data) {
  const { feeds, subscribers } = data
  const relevantFeeds = getRelevantFeeds(subscribers, feeds)
  const visual = commonPrompts.selectFeed.visual({
    ...data,
    feeds: relevantFeeds
  })
  return visual
}

/**
 * @param {import('discord.js').Message} message
 * @param {Data} data
 */
async function selectFeedFn (message, data) {
  const { feeds, subscribers } = data
  const index = Number(message.content) - 1
  const relevantFeeds = getRelevantFeeds(subscribers, feeds)
  const selectedFeed = relevantFeeds[index]
  return {
    ...data,
    selectedFeed,
    selectedSubscriber: subscribers.find(s => s.feed === selectedFeed._id)
  }
}

const prompt = new LocalizedPrompt(selectFeedVisual, selectFeedFn)

exports.visual = selectFeedVisual
exports.fn = selectFeedFn
exports.prompt = prompt
