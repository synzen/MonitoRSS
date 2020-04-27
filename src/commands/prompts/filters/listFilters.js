const { MessageVisual } = require('discord.js-prompts')
const ThemedEmbed = require('../common/utils/ThemedEmbed')
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
function visual (data) {
  const { profile, selectedFeed: feed } = data
  const translate = Translator.createProfileTranslator(profile)

  if (!feed.hasFilters()) {
    return new MessageVisual(translate('commands.filters.noFilters', {
      link: feed.url
    }))
  }
  const embed = new ThemedEmbed({
    author: {
      name: translate('commands.filters.listFilters')
    },
    description: translate('commands.filters.listFiltersDescription', {
      title: feed.title,
      link: feed.url
    })
  })
  for (const filterCat in feed.filters) {
    const filterContent = feed.filters[filterCat]
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

const prompt = new LocalizedPrompt(visual)

exports.prompt = prompt
