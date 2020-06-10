const { Rejection, MessageVisual } = require('discord.js-prompts')
const LocalizedPrompt = require('../common/utils/LocalizedPrompt.js')
const Subscriber = require('../../../structs/db/Subscriber.js')
const Translator = require('../../../structs/Translator.js')
const createLogger = require('../../../util/logger/create.js')

/**
 * @typedef {Object} Data
 * @property {import('../../../structs/db/Feed.js')[]} feeds
 * @property {import('../../../structs/db/Profile.js')} profile
 * @property {string[]} properties
 * @property {import('../../../structs/db/Feed.js')} sourceFeed
 * @property {import('../../../structs/db/Feed.js')[]} destinationFeeds
 */

/**
 * @param {Data} data
 */
function confirmVisual (data) {
  const { profile, sourceFeed, destinationFeeds, properties } = data
  const translate = Translator.createProfileTranslator(profile)
  return new MessageVisual(translate('commands.clone.confirm', {
    link: sourceFeed.url,
    cloning: properties.join('`, `'),
    destinations: destinationFeeds.map(selected => selected.url).join('\n').trim()
  }))
}

/**
 * @param {import('discord.js').Message} message
 * @param {Data} data
 */
async function confirmFn (message, data) {
  const { profile, destinationFeeds, sourceFeed, properties } = data
  const { content } = message
  const translate = Translator.createProfileTranslator(profile)
  if (content !== 'yes') {
    throw new Rejection(translate('commands.clone.confirmError'))
  }
  const cloneAll = properties.includes('all')
  const cloneFilters = cloneAll || properties.includes('filters')
  const cloneMiscOptions = cloneAll || properties.includes('misc-options')
  const cloneMessage = cloneAll || properties.includes('message')
  const cloneSubscribers = cloneAll || properties.includes('subscribers')
  const cloneComparisons = cloneAll || properties.includes('comparisons')
  const log = createLogger(message.client.shard.ids[0])

  const copyFromSubscribers = await sourceFeed.getSubscribers()

  for (const destinationFeed of destinationFeeds) {
    let updateSelected = false
    // Filters
    if (cloneFilters) {
      destinationFeed.filters = sourceFeed.filters
      updateSelected = true
    }

    // Misc Options
    if (cloneMiscOptions) {
      destinationFeed.checkDates = sourceFeed.checkDates
      destinationFeed.formatTables = sourceFeed.formatTables
      destinationFeed.imgLinksExistence = sourceFeed.imgLinksExistence
      destinationFeed.imgPreviews = sourceFeed.imgPreviews
      destinationFeed.toggleRoleMentions = sourceFeed.toggleRoleMentions
      destinationFeed.directSubscribers = sourceFeed.directSubscribers
      updateSelected = true
    }

    // Format
    if (cloneMessage) {
      destinationFeed.text = sourceFeed.text
      destinationFeed.embeds = sourceFeed.embeds
      updateSelected = true
    }

    // Comparisons
    if (cloneComparisons) {
      destinationFeed.ncomparisons = sourceFeed.ncomparisons
      destinationFeed.pcomparisons = sourceFeed.pcomparisons
      updateSelected = true
    }

    if (updateSelected) {
      await destinationFeed.save()
    }

    // Subscribers
    if (cloneSubscribers) {
      // Delete the destinationFeed feed's subscribers
      const subscribers = await destinationFeed.getSubscribers()
      const deletions = []
      for (const subscriber of subscribers) {
        deletions.push(subscriber.delete())
      }
      await Promise.all(deletions)
      // Save the new ones
      const saves = []
      for (const copyFromSubscriber of copyFromSubscribers) {
        const subscriberData = copyFromSubscriber.toJSON()
        subscriberData.feed = destinationFeed._id
        const newSubscriber = new Subscriber(subscriberData)
        saves.push(newSubscriber.save())
      }
      await Promise.all(saves)
    }
  }
  log.info({
    guild: message.guild,
    user: message.author
  }, `Properties ${properties.join(',')} for the feed ${sourceFeed.url} cloned to to ${destinationFeeds.length} feeds`)
  return data
}

const prompt = new LocalizedPrompt(confirmVisual, confirmFn)

exports.prompt = prompt
