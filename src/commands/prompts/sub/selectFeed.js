const { DiscordPrompt } = require('discord.js-prompts')
const Subscriber = require('../../../structs/db/Subscriber.js')
const commonPrompts = require('../common/index.js')
/**
 * @typedef {Object} Data
 * @property {import('../../../structs/db/Profile.js')} [profile]
 * @property {import('../../../structs/db/Feed.js')[]} feeds
 */

/**
 * @param {Data} data
 */
function selectFeedVisual (data) {
  return commonPrompts.selectFeed.visual(data)
}

/**
 * @param {import('discord.js').Message} message
 * @param {Data} data
 */
async function selectFeedFn (message, data) {
  const newData = await commonPrompts.selectFeed.fn(message, data)
  const { selectedFeed: feed } = newData
  const { author } = message
  const feedID = feed._id
  const existingSubscriber = await Subscriber.getByQuery({
    feed: feedID,
    id: author.id
  })
  if (existingSubscriber) {
    return {
      ...newData,
      newSubscriber: false
    }
  }
  const subscriber = new Subscriber({
    feed: feedID,
    id: author.id,
    type: 'user'
  })
  await subscriber.save()
  return {
    ...newData,
    newSubscriber: true
  }
}

const prompt = new DiscordPrompt(selectFeedVisual, selectFeedFn)

exports.prompt = prompt
