const { MessageEmbed } = require('discord.js')
const { DiscordPrompt, MessageVisual } = require('discord.js-prompts')
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
  const embed = new MessageEmbed({
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

const prompt = new DiscordPrompt(visual)

exports.prompt = prompt
