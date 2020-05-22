const { MessageVisual } = require('discord.js-prompts')
const LocalizedPrompt = require('../common/utils/LocalizedPrompt.js')
const Translator = require('../../../structs/Translator.js')
const getConfig = require('../../../config.js').get

/**
 * @typedef {Object} Data
 * @property {import('../../../structs/db/Profile.js')} [profile]
 * @property {import('../../../structs/db/Feed.js')[]} feeds
 * @property {import('../../../structs/db/Feed.js')} selectedFeed
 * @property {import('../../../structs/db/Subscriber.js')} removedSubscriber
 */

/**
 * @param {Data} data
 */
async function removeSubscriberSuccessVisual (data) {
  const { profile, removedSubscriber, selectedFeed: feed } = data
  const config = getConfig()
  const translate = Translator.createProfileTranslator(profile)
  const prefix = profile && profile.prefix ? profile.prefix : config.bot.prefix
  return new MessageVisual(`${translate('commands.mention.removeSubscriberSuccess', {
    link: feed.url,
    mention: removedSubscriber.type === 'role' ? `<@&${removedSubscriber.id}>` : `<@${removedSubscriber.id}>`
  })} ${translate('generics.backupReminder', { prefix })}`)
}

const prompt = new LocalizedPrompt(removeSubscriberSuccessVisual)

exports.prompt = prompt
