const { MessageVisual } = require('discord.js-prompts')
const LocalizedPrompt = require('../common/utils/LocalizedPrompt.js')
const Translator = require('../../../structs/Translator.js')

/**
 * @typedef {Object} Data
 * @property {import('../../../structs/db/Profile.js')} [profile]
 * @property {import('../../../structs/db/Feed.js')[]} feeds
 * @property {import('../../../structs/db/Feed.js')} [selectedFeed]
 * @property {number} targetEmbedIndex
 * @property {string} selected
 * @property {number} removedFieldIndex
 */

/**
 * @param {Data} data
 */
function addFieldSuccessVisual (data) {
  const { profile, removedFieldIndex, selectedFeed: feed } = data
  const translate = Translator.createProfileTranslator(profile)
  return new MessageVisual(translate('commands.embed.embedFieldsRemoved', {
    numbers: removedFieldIndex,
    link: feed.url
  }))
}

const prompt = new LocalizedPrompt(addFieldSuccessVisual)

exports.prompt = prompt
