const { Rejection } = require('discord.js-prompts')
const LocalizedPrompt = require('../common/utils/LocalizedPrompt.js')
const commonPrompts = require('../common/index.js')
const Subscriber = require('../../../structs/db/Subscriber.js')
const Translator = require('../../../structs/Translator.js')
const getConfig = require('../../../config.js').get

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
  const { selectedFeed: feed, profile } = newData
  const { author } = message
  const feedID = feed._id
  const translate = Translator.createProfileTranslator(profile)
  const config = getConfig()
  const prefix = profile && profile.prefix ? profile.prefix : config.bot.prefix

  const enabled = feed.directSubscribers === undefined ? config.feeds.directSubscribers : feed.directSubscribers
  if (!enabled) {
    throw new Rejection(translate('commands.sub.directSubscriberDisabled', {
      link: feed.url,
      channel: `<#${feed.channel}>`,
      prefix
    }))
  }

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

const prompt = new LocalizedPrompt(selectFeedVisual, selectFeedFn)

exports.prompt = prompt
