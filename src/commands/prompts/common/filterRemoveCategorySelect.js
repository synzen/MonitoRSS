const { MessageEmbed } = require('discord.js')
const { Rejection, DiscordPrompt, MessageVisual } = require('discord.js-prompts')
const Translator = require('../../../structs/Translator.js')
const createLogger = require('../../../util/logger/create.js')
const getConfig = require('../../../config.js').get

/**
 * @typedef {Object} Data
 * @property {import('../../../structs/db/Profile.js')} [profile]
 * @property {import('../../../structs/db/Feed.js')[]} feeds
 * @property {import('../../../structs/db/Feed.js')} [selectedFeed]
 * @property {import('../../../structs/db/Subscriber.js')|import('../../../structs/db/Feed.js')} target
 */

/**
 * @param {Data} data
 */
function visual (data) {
  const { profile, selectedFeed: feed, target } = data
  const translate = Translator.createProfileTranslator(profile)
  const embed = new MessageEmbed({
    title: translate('commands.utils.filters.listOfFilters'),
    description: translate('commands.utils.filters.listOfFiltersDescription', {
      title: feed.title,
      link: feed.url
    })
  })

  const filterList = target.filters

  for (const filterCategory in filterList) {
    const filters = filterList[filterCategory]
    let value = ''
    for (const filter of filters) {
      value += `${filter}\n`
    }
    embed.addField(filterCategory, value, true)
  }

  const visual = new MessageVisual('', {
    embed
  })
  return visual
}

/**
 * @param {import('discord.js').Message} message
 * @param {Data} data
 */
async function fn (message, data) {
  const { profile } = data
  const { content } = message
  const translate = Translator.createProfileTranslator(profile)
  const validInput = ['title', 'description', 'summary', 'author', 'tags']
  if (!validInput.includes(content.toLowerCase()) && !content.startsWith('raw:') && !content.startsWith('other:')) {
    throw new Rejection(translate('commands.utils.filters.invalidCategory'))
  }
  return {
    ...data,
    filterCategory: content
  }
}

const prompt = new DiscordPrompt(visual, fn)

exports.prompt = prompt
