const { MessageVisual } = require('discord.js-prompts')
const LocalizedPrompt = require('../common/utils/LocalizedPrompt.js')
const Translator = require('../../../structs/Translator.js')

/**
 * @typedef {Object} Data
 * @property {import('../../../structs/db/Feed.js')[]} feeds
 * @property {import('../../../structs/db/Profile.js')} profile
 * @property {boolean} removed
 */

/**
 * @param {Data} data
 */
function removedSuccessVisual (data) {
  const { profile, selectedFeed: feed } = data
  const translate = Translator.createProfileTranslator(profile)
  return new MessageVisual(translate('commands.webhook.removeSuccess', {
    link: feed.url
  }))
}

const prompt = new LocalizedPrompt(removedSuccessVisual)

exports.prompt = prompt
