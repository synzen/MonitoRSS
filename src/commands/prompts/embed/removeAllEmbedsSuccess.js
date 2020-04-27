const { DiscordPrompt, MessageVisual } = require('discord.js-prompts')
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
  const { profile } = data
  const translate = Translator.createProfileTranslator(profile)

  return new MessageVisual(translate('commands.embed.removedAllEmbeds'))
}

const prompt = new DiscordPrompt(removeAllEmbedsSuccessVisual)

exports.prompt = prompt
