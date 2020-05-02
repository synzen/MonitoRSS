const { MessageVisual } = require('discord.js-prompts')
const LocalizedPrompt = require('../common/utils/LocalizedPrompt.js')
const Translator = require('../../../structs/Translator.js')

/**
 * @typedef {Object} Data
 * @property {import('../../../structs/db/Profile.js')} [profile]
 * @property {import('../../../structs/db/Feed.js')[]} feeds
 * @property {import('../../../structs/db/Feed.js')} [selectedFeed]
 * @property {number} targetEmbedIndex
 */

/**
 * @param {Data} data
 */
function removeAllEmbedsSuccessVisual (data) {
  const { profile, selectedFeed } = data
  const translate = Translator.createProfileTranslator(profile)

  return new MessageVisual(translate('commands.embed.removedAllEmbeds', {
    link: selectedFeed.url
  }))
}

const prompt = new LocalizedPrompt(removeAllEmbedsSuccessVisual)

exports.prompt = prompt
