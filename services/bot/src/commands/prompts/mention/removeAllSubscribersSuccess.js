const { MessageVisual } = require('discord.js-prompts')
const LocalizedPrompt = require('../common/utils/LocalizedPrompt.js')
const Translator = require('../../../structs/Translator.js')

/**
 * @typedef {Object} Data
 * @property {import('../../../structs/db/Profile.js')} [profile]
 * @property {import('../../../structs/db/Feed.js')[]} feeds
 * @property {import('../../../structs/db/Feed.js')} selectedFeed
 */

/**
 * @param {Data} data
 */
async function removeAllSubscribersSuccessVisual (data) {
  const { profile, selectedFeed: feed } = data
  const translate = Translator.createProfileTranslator(profile)
  return new MessageVisual(translate('commands.mention.removeAllSubscribersSuccess', {
    link: feed.url
  }))
}

const prompt = new LocalizedPrompt(removeAllSubscribersSuccessVisual)

exports.prompt = prompt
