const { Rejection, MessageVisual } = require('discord.js-prompts')
const LocalizedPrompt = require('../common/utils/LocalizedPrompt.js')
const Subscriber = require('../../../structs/db/Subscriber.js')
const Translator = require('../../../structs/Translator.js')

/**
 * @typedef {Object} Data
 * @property {import('../../../structs/db/Profile.js')} [profile]
 * @property {import('../../../structs/db/Feed.js')[]} feeds
 * @property {import('../../../structs/db/Feed.js')} selectedFeed
 */

/**
 * @param {Data} data
 */
async function selectSubscriberVisual (data) {
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
async function selectSubscriberFn (message, data) {
  const { mentions } = message
  const { profile, selectedFeed: feed } = data
  const translate = Translator.createProfileTranslator(profile)
  const memberMention = mentions.members.first()
  const roleMention = mentions.roles.first()
  let id
  if (memberMention) {
    id = memberMention.id
  } else if (roleMention) {
    id = roleMention.id
  } else {
    throw new Rejection(translate('commands.mention.invalidRoleOrUser'))
  }
  const subscriber = await Subscriber.getByQuery({
    id,
    feed: feed._id
  })
  if (!subscriber) {
    throw new Rejection(translate('commands.mention.notFeedSubscriber', {
      link: feed.url
    }))
  }
  return {
    ...data,
    selectedSubscriber: subscriber
  }
}

const prompt = new LocalizedPrompt(selectSubscriberVisual, selectSubscriberFn)

exports.prompt = prompt
