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
 */

/**
 * @param {Data} data
 */
function addBlankFieldSuccessVisual (data) {
  const { profile, selected, selectedFeed: feed } = data
  const translate = Translator.createProfileTranslator(profile)
  let string
  if (selected === '3') {
    // Regular
    string = translate('commands.embed.embedFieldsAddedBlank', {
      link: feed.url
    })
  } else if (selected === '4') {
    // Inline
    string = translate('commands.embed.embedFieldsAddedBlankInline', {
      link: feed.url
    })
  }
  return new MessageVisual(string)
}

const prompt = new LocalizedPrompt(addBlankFieldSuccessVisual)

exports.prompt = prompt
