const { MessageVisual } = require('discord.js-prompts')
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
    return new MessageVisual(translate('commands.mention.filters.listNoFilters', {
      link: feed.url,
      subscriber: subscriberString
    }))
  }

  let output = translate('commands.mention.filters.listFiltersDescription', {
    link: feed.url,
    subscriber: subscriberString,
    channel: `<#${feed.channel}>`
  })
  for (const filterCat in subscriber.filters) {
    output += `\n\n**${filterCat}**`
    const filterContent = subscriber.filters[filterCat]
    filterContent.forEach((filter) => {
      output += `\n${filter}`
    })
  }

  return new MessageVisual(output, {
    split: true
  })
}

const prompt = new LocalizedPrompt(listFiltersVisual)

exports.prompt = prompt
