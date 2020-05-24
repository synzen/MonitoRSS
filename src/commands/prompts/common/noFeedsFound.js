const LocalizedPrompt = require('./utils/LocalizedPrompt.js')
const Translator = require('../../../structs/Translator.js')
const { MessageVisual } = require('discord.js-prompts')
/**
 * @typedef {Object} Data
 * @property {import('../../../structs/db/Profile.js')} [profile]
 * @property {import('../../../structs/db/Feed.js')[]} feeds
 */

/**
 * @param {Data} data
 */
function noFeedsFoundVisual (data) {
  const { locale } = data.profile || {}
  return new MessageVisual(Translator.translate('structs.FeedSelector.noFeeds', locale))
}

const prompt = new LocalizedPrompt(noFeedsFoundVisual)

exports.prompt = prompt
