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
async function removeSubscriberVisual (data) {
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
async function removeSubscriberFn (message, data) {
  const { guild, author, client, mentions } = message
  const { selectedFeed: feed, profile } = data
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
  const foundSubscriber = await Subscriber.getByQuery({
    id,
    feed: feed._id
  })
  if (!foundSubscriber) {
    throw new Rejection(translate('commands.mention.notFeedSubscriber', {
      link: feed.url
    }))
  }

  await foundSubscriber.delete()
  const log = createLogger(client.shard.ids[0])
  log.info({
    guild,
    user: author
  }, `Deleted subscriber ${id} from feed ${feed.url}`)
  return {
    ...data,
    removedSubscriber: foundSubscriber
  }
}

const prompt = new LocalizedPrompt(removeSubscriberVisual, removeSubscriberFn)

exports.prompt = prompt
