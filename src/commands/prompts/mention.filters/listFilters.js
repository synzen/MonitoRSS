const { MessageVisual } = require('discord.js-prompts')
const ThemedEmbed = require('../common/utils/ThemedEmbed')
const LocalizedPrompt = require('../common/utils/LocalizedPrompt.js')
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
function listFiltersVisual (data) {
  const { profile, selectedSubscriber: subscriber, selectedFeed: feed } = data
  const translate = Translator.createProfileTranslator(profile)
  const subscriberString = subscriber.type === 'role' ? `<@&${subscriber.id}>` : `<@${subscriber.id}>`
  if (!subscriber.hasFilters()) {
    return new MessageVisual(translate('commands.mention.filters.noFilters', {
      link: feed.url,
      subscriber: subscriberString
    }))
  }
  const embed = new ThemedEmbed({
    title: translate('commands.mention.filters.title'),
    description: translate('commands.mention.filters.listFiltersDescription', {
      title: feed.title,
      link: feed.url,
      subscriber: subscriberString
    })
  })

  for (const filterCat in subscriber.filters) {
    const filterContent = subscriber.filters[filterCat]
    let value = ''
    filterContent.forEach((filter) => {
      value += `${filter}\n`
    })
    embed.addField(filterCat, value, true)
  }

  return new MessageVisual('', {
    embed
  })
}

const prompt = new LocalizedPrompt(listFiltersVisual)

exports.prompt = prompt
