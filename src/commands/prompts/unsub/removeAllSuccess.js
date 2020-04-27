const { MessageVisual } = require('discord.js-prompts')
const LocalizedPrompt = require('../common/utils/LocalizedPrompt.js')
const Translator = require('../../../structs/Translator.js')

/**
 * @typedef {Object} Data
 * @property {import('../../../structs/db/Profile.js')} [profile]
 * @property {import('../../../structs/db/Feed.js')[]} feeds
 */

/**
 * @param {Data} data
 */
function removeDirectSuccess (data) {
  const { profile } = data
  const translate = Translator.createProfileTranslator(profile)
  // Newly added
  return new MessageVisual(translate('commands.unsub.removeAllSuccess'))
}

const prompt = new LocalizedPrompt(removeDirectSuccess)

exports.prompt = prompt
