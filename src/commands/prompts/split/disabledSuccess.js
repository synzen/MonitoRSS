const { DiscordPrompt, MessageVisual } = require('discord.js-prompts')
const Translator = require('../../../structs/Translator.js')

/**
 * @typedef {Object} Data
 * @property {import('../../../structs/db/Profile.js')} [profile]
 * @property {import('../../../structs/db/Feed.js')[]} feeds
 * @property {import('../../../structs/db/Feed.js')} selectedFeed
 * @property {string} selected
 */

/**
 * @param {Data} data
 */
function disabledSuccessVisual (data) {
  const { profile, selectedFeed: feed } = data
  const translate = Translator.createProfileTranslator(profile)
  return new MessageVisual(translate('commands.split.disabledSuccess', {
    link: feed.url
  }))
}

const prompt = new DiscordPrompt(disabledSuccessVisual)

exports.prompt = prompt
