const { MessageVisual } = require('discord.js-prompts')
const LocalizedPrompt = require('../common/utils/LocalizedPrompt.js')
const Translator = require('../../../structs/Translator.js')
const getConfig = require('../../../config.js').get

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
function confirmSuccessVisual (data) {
  const { profile, sourceFeed, destinationFeeds, properties } = data
  const translate = Translator.createProfileTranslator(profile)
  const config = getConfig()
  const prefix = profile && profile.prefix ? profile.prefix : config.bot.prefix
  return new MessageVisual(`${translate('commands.clone.success', {
    cloned: properties.join('`, `'),
    link: sourceFeed.url,
    destinationCount: destinationFeeds.length
  })} ${translate('generics.backupReminder', { prefix })}`)
}

const prompt = new LocalizedPrompt(confirmSuccessVisual)

exports.prompt = prompt
