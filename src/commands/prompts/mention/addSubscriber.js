const { Rejection, MessageVisual } = require('discord.js-prompts')
const LocalizedPrompt = require('../common/utils/LocalizedPrompt.js')
const Subscriber = require('../../../structs/db/Subscriber.js')
const Translator = require('../../../structs/Translator.js')
const createLogger = require('../../../util/logger/create.js')

/**
 * @typedef {Object} Data
 * @property {import('../../../structs/db/Profile.js')} [profile]
 * @property {import('../../../structs/db/Feed.js')[]} feeds
 * @property {import('../../../structs/db/Feed.js')} selectedFeed
 */

/**
 * @param {Data} data
 */
async function addSubscriberVisual (data) {
  const { profile, selectedFeed: feed } = data
  const translate = Translator.createProfileTranslator(profile)
  return new MessageVisual(translate('commands.mention.promptUserOrRole', {
    link: feed.url,
    channel: `<#${feed.channel}>`
  }))
}

/**
 * @param {import('discord.js').Message} message
 * @param {Data} data
 */
async function addSubscriberFn (message, data) {
  const { guild, author, client, mentions } = message
  const { selectedFeed: feed, profile } = data
  const translate = Translator.createProfileTranslator(profile)

  const memberMention = mentions.members.first()
  const roleMention = mentions.roles.first()
  const subscriberData = {
    feed: feed._id
  }
  if (memberMention) {
    subscriberData.id = memberMention.id
    subscriberData.type = 'user'
  } else if (roleMention) {
    subscriberData.id = roleMention.id
    subscriberData.type = 'role'
  } else {
    throw new Rejection(translate('commands.mention.invalidRoleOrUser'))
  }
  const existingSubscriber = await Subscriber.getByQuery({
    id: subscriberData.id,
    feed: feed._id
  })
  if (existingSubscriber) {
    throw new Rejection(translate('commands.mention.addSubscriberExists', {
      type: subscriberData.type,
      mention: existingSubscriber.type === 'role' ? `<@&${subscriberData.id}>` : `<@${subscriberData.id}>`
    }))
  }

  const subscriber = new Subscriber(subscriberData)
  await subscriber.save()
  const log = createLogger(client.shard.ids[0])
  log.info({
    guild,
    user: author,
    subscriberData
  }, `Added subscriber to feed ${feed.url}`)
  return {
    ...data,
    addedSubscriber: subscriber
  }
}

const prompt = new LocalizedPrompt(addSubscriberVisual, addSubscriberFn)

exports.prompt = prompt
