const { DiscordPrompt, MessageVisual } = require('discord.js-prompts')
const Translator = require('../../../structs/Translator.js')

/**
 * @typedef {Object} Data
 * @property {import('../../../structs/db/Profile.js')} [profile]
 * @property {import('../../../structs/db/Feed.js')[]} feeds
 * @property {import('../../../structs/db/Feed.js')} selectedFeed
 * @property {boolean} newSubscriber
 */

/**
 * @param {Data} data
 */
function addDirectResult (data) {
  const { newSubscriber, profile, selectedFeed: feed } = data
  const translate = Translator.createProfileTranslator(profile)
  if (newSubscriber) {
    // Newly added
    return new MessageVisual(translate('commands.sub.directSubscribeSuccess', {
      link: feed.url
    }))
  } else {
    // Already exists
    return new MessageVisual(translate('commands.sub.directSubscribeExists', {
      link: feed.url
    }))
  }
}

const prompt = new DiscordPrompt(addDirectResult)

exports.prompt = prompt
