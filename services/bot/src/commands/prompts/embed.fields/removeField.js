const { MenuEmbed, MenuVisual } = require('discord.js-prompts')
const ThemedEmbed = require('../common/utils/ThemedEmbed')
const LocalizedPrompt = require('../common/utils/LocalizedPrompt.js')
const Translator = require('../../../structs/Translator.js')
const createLogger = require('../../../util/logger/create.js')

/**
 * @typedef {Object} Data
 * @property {import('../../../structs/db/Profile.js')} [profile]
 * @property {import('../../../structs/db/Feed.js')[]} feeds
 * @property {import('../../../structs/db/Feed.js')} [selectedFeed]
 * @property {number} targetEmbedIndex
 * @property {string} selected
 */

/**
 * @param {Data} data
 */
function removeFieldVisual (data) {
  const { profile, selectedFeed: feed, targetEmbedIndex } = data
  const translate = Translator.createProfileTranslator(profile)
  const embed = new ThemedEmbed()
    .setTitle(translate('commands.embed.embedFieldsOptionRemoveEmbedTitle'))
    .setDescription(translate('commands.embed.embedFieldsOptionRemoveEmbedDescription'))
  const menu = new MenuEmbed(embed)

  const fields = feed.embeds[targetEmbedIndex].fields
  for (const field of fields) {
    const inline = field.inline ? `(${translate('commands.embed.inline')})` : `(${translate('commands.embed.regular')})`
    // Empty string name
    if (field.name === '\u200b') {
      menu.addOption(`${inline} ${translate('commands.embed.blankField')}`, '\u200b')
    } else {
      menu.addOption(`${inline} ${field.name}`, field.value)
    }
  }
  return new MenuVisual(menu)
}

/**
 * @param {import('discord.js').Message} message
 * @param {Data} data
 */
async function removeFieldFn (message, data) {
  const { targetEmbedIndex, selectedFeed: feed } = data
  const { content } = message
  const fields = feed.embeds[targetEmbedIndex].fields
  const index = Number(content) - 1
  fields.splice(index, 1)
  await feed.save()
  const log = createLogger()
  log.info({
    guild: message.guild,
    user: message.author
  }, `Embed[${targetEmbedIndex}] field at index ${index} deleted`)
  return {
    ...data,
    removedFieldIndex: index
  }
}

const prompt = new LocalizedPrompt(removeFieldVisual, removeFieldFn)

exports.prompt = prompt
