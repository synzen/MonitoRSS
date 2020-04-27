const { MessageVisual } = require('discord.js-prompts')
const LocalizedPrompt = require('../common/utils/LocalizedPrompt.js')
const Translator = require('../../../structs/Translator.js')

/**
 * @typedef {Object} Data
 * @property {import('../../../structs/db/Profile.js')} [profile]
 * @property {import('../../../structs/db/Feed.js')[]} feeds
 * @property {import('../../../structs/db/Feed.js')} [selectedFeed]
 * @property {string} selected
 */

/**
 * @param {Data} data
 */
function removedAllFiltersSuccess (data) {
  const { selectedFeed: feed, profile } = data
  const translate = Translator.createProfileTranslator(profile)
  return new MessageVisual(translate('commands.filters.removedAllSuccess', {
    link: feed.url
  }))
}

const prompt = new LocalizedPrompt(removedAllFiltersSuccess)

exports.prompt = prompt
