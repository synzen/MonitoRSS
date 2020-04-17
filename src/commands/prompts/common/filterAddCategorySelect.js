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
  const { profile, selectedFeed: feed } = data
  const translate = Translator.createProfileTranslator(profile)
  const embed = new MessageEmbed({
    title: translate('commands.utils.filters.filtersCustomization'),
    description: `**${translate('commands.utils.filters.feed')}:** ${feed.url}\n\n${translate('commands.utils.filters.categoryDescription')}`
  }).addField('Title', '\u200b')
    .addField('Description', '\u200b')
    .addField('Summary', '\u200b')
    .addField('Author', '\u200b')
    .addField('Tags', '\u200b')

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
