const { Rejection, MessageVisual } = require('discord.js-prompts')
const ThemedEmbed = require('./utils/ThemedEmbed.js')
const LocalizedPrompt = require('./utils/LocalizedPrompt.js')
const Translator = require('../../../structs/Translator.js')

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
  const embed = new ThemedEmbed({
    title: translate('commands.utils.filters.filtersCustomization'),
    description: `**${translate('commands.utils.filters.feed')}:** ${feed.url}\n\n${translate('commands.utils.filters.categoryDescription')}`
  }).addField('title', '\u200b')
    .addField('description', '\u200b')
    .addField('summary', '\u200b')
    .addField('author', '\u200b')
    .addField('tags', '\u200b')

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
  if (!validInput.includes(content) && !content.startsWith('raw:') && !content.startsWith('other:')) {
    throw new Rejection(translate('commands.utils.filters.invalidCategory'))
  }
  return {
    ...data,
    filterCategory: content
  }
}

const prompt = new LocalizedPrompt(visual, fn)

exports.prompt = prompt
