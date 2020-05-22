const { MessageVisual } = require('discord.js-prompts')
const LocalizedPrompt = require('../common/utils/LocalizedPrompt.js')
const Translator = require('../../../structs/Translator.js')
const getConfig = require('../../../config.js').get

/**
 * @typedef {Object} Data
 * @property {import('../../../structs/db/Profile.js')} [profile]
 * @property {import('../../../structs/db/Feed.js')[]} feeds
 * @property {import('../../../structs/db/Feed.js')} selectedFeed
 * @property {import('../../../structs/db/Subscriber.js')} addedSubscriber
 */

/**
 * @param {Data} data
 */
async function addSubscriberSuccessVisual (data) {
  const { profile, addedSubscriber, selectedFeed: feed } = data
  const config = getConfig()
  const translate = Translator.createProfileTranslator(profile)
  const prefix = profile && profile.prefix ? profile.prefix : config.bot.prefix
  return new MessageVisual(`${translate('commands.mention.addSubscriberSuccess', {
    link: feed.url,
    mention: addedSubscriber.type === 'role' ? `<@&${addedSubscriber.id}>` : `<@${addedSubscriber.id}>`,
    type: addedSubscriber.type === 'role' ? translate('commands.mention.role') : translate('commands.mention.user')
  })} ${translate('generics.backupReminder', { prefix })}`)
}

const prompt = new LocalizedPrompt(addSubscriberSuccessVisual)

exports.prompt = prompt
