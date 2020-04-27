const { DiscordPrompt, MessageVisual } = require('discord.js-prompts')
const Translator = require('../../../structs/Translator.js')

/**
 * @typedef {Object} Data
 * @property {import('../../../structs/db/Profile.js')} [profile]
 * @property {import('../../../structs/db/Feed.js')[]} feeds
 * @property {import('../../../structs/db/Feed.js')} selectedFeed
 * @property {import('../../../structs/db/Subscriber.js')} selectedSubscriber
 */

/**
 * @param {Data} data
 */
function removeAllFiltersSuccess (data) {
  const { profile, selectedFeed: feed, selectedSubscriber: subscriber } = data
  const translate = Translator.createProfileTranslator(profile)
  return new MessageVisual(translate('commands.mention.filters.removedAllFilters', {
    subscriber: subscriber.type === 'role' ? `<@&${subscriber.id}>` : `<@${subscriber.id}>`,
    link: feed.url
  }))
}

const prompt = new DiscordPrompt(removeAllFiltersSuccess)

exports.prompt = prompt
