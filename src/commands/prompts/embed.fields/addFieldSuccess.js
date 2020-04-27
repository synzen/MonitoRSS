const { DiscordPrompt, MessageVisual } = require('discord.js-prompts')
const Translator = require('../../../structs/Translator.js')

/**
 * @typedef {Object} Data
 * @property {import('../../../structs/db/Profile.js')} [profile]
 * @property {import('../../../structs/db/Feed.js')[]} feeds
 * @property {import('../../../structs/db/Feed.js')} [selectedFeed]
 * @property {number} targetEmbedIndex
 * @property {string} selected
 * @property {Object<string, any>} newField
 */

/**
 * @param {Data} data
 */
function addFieldSuccessVisual (data) {
  const { profile, selected, newField, selectedFeed: feed } = data
  const translate = Translator.createProfileTranslator(profile)
  const { name, value } = newField
  return new MessageVisual(translate('commands.embed.embedFieldsAdded', {
    type: selected === '2' ? ' inline' : '',
    name,
    value: value.length > 1500 ? value.slice(0, 1500) + '...' : value,
    link: feed.url
  }))
}

const prompt = new DiscordPrompt(addFieldSuccessVisual)

exports.prompt = prompt
