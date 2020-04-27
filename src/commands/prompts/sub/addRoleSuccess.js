const { DiscordPrompt, MessageVisual } = require('discord.js-prompts')
const Translator = require('../../../structs/Translator.js')

/**
 * @typedef {Object} Data
 * @property {import('../../../structs/db/Profile.js')} [profile]
 * @property {import('../../../structs/db/Feed.js')[]} feeds
 * @property {import('../../../structs/db/Subscriber.js')[][]} subscribers
 * @property {import('discord.js').Role} addedRole
 */

/**
 * @param {Data} data
 */
function addRoleSuccess (data) {
  const { addedRole, profile, feeds, subscribers } = data
  const translate = Translator.createProfileTranslator(profile)

  const subscribedFeedIDs = subscribers
    .flat()
    .filter(subscriber => subscriber.id === addedRole.id)
    .map(s => s.feed)

  const feedURLs = subscribedFeedIDs.map(id => feeds.find(feed => feed._id === id).url)
  return new MessageVisual(`${translate('commands.sub.addSuccess', {
    name: `${addedRole.name}`
  })}\n\n${feedURLs.map(url => `**<${url}>**`).join('\n')}`)
}

const prompt = new DiscordPrompt(addRoleSuccess)

exports.prompt = prompt
