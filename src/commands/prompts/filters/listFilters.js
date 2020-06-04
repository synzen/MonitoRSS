const { MessageVisual } = require('discord.js-prompts')
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

  let output = translate('commands.filters.listFiltersDescription', {
    title: feed.title,
    link: feed.url,
    channel: `<#${feed.channel}>`
  })
  for (const filterCat in feed.filters) {
    output += `\n\n**${filterCat}**`
    const filterContent = feed.filters[filterCat]
    filterContent.forEach((filter) => {
      output += `\n${filter}`
    })
  }

  return new MessageVisual(output, {
    split: true
  })
}

const prompt = new LocalizedPrompt(visual)

exports.prompt = prompt
