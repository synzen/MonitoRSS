const { Rejection, MenuVisual, MenuEmbed } = require('discord.js-prompts')
const ThemedEmbed = require('../common/utils/ThemedEmbed')
const LocalizedPrompt = require('../common/utils/LocalizedPrompt.js')
const Translator = require('../../../structs/Translator.js')

/**
 * @typedef {Object} Data
 * @property {import('../../../structs/db/Profile.js')} [profile]
 * @property {import('../../../structs/db/Feed.js')[]} feeds
 * @property {import('../../../structs/db/Feed.js')} [selectedFeed]
 * @property {number} targetEmbedIndex
 */

/**
 * @param {Data} data
 */
function selectActionVisual (data) {
  const { profile } = data
  const translate = Translator.createProfileTranslator(profile)
  const embed = new ThemedEmbed()
    .setTitle(translate('commands.embed.embedFields'))
    .setDescription(translate('commands.embed.embedFieldsDescription'))
  const menu = new MenuEmbed(embed)
    .addOption(translate('commands.embed.embedFieldsOptionAddRegular'), translate('commands.embed.embedFieldsOptionAddRegularDescription'))
    .addOption(translate('commands.embed.embedFieldsOptionAddInline'), translate('commands.embed.embedFieldsOptionAddInlineDescription'))
    .addOption(translate('commands.embed.embedFieldsOptionAddRegularBlank'), translate('commands.embed.embedFieldsOptionAddRegularBlankDescription'))
    .addOption(translate('commands.embed.embedFieldsOptionAddInlineBlank'), translate('commands.embed.embedFieldsOptionAddInlineBlankDescription'))
    .addOption(translate('commands.embed.embedFieldsOptionRemove'), translate('commands.embed.embedFieldsOptionRemoveDescription'))

  return new MenuVisual(menu)
}

/**
 * @param {import('discord.js').Message} message
 * @param {Data} data
 */
async function selectActionFn (message, data) {
  const { profile, targetEmbedIndex, selectedFeed: feed } = data
  const { content: selected } = message
  const embeds = feed.embeds
  const translate = Translator.createProfileTranslator(profile)
  const newData = {
    ...data,
    selected
  }
  // Remove a field
  if (selected === '5') {
    const embed = embeds[targetEmbedIndex]
    if (!embed || embed.fields.length === 0) {
      throw new Rejection(translate('commands.embed.embedFieldsRemoveNone'))
    }
    return newData
  }
  if (!embeds[targetEmbedIndex]) {
    embeds.push({ fields: [] })
  }
  const embed = embeds[targetEmbedIndex]
  if (selected === '4' || selected === '5') {
    embed.fields.push({
      name: '\u200b',
      value: '\u200b',
      inline: selected === '4'
    })
    await feed.save()
  }
  return newData
}

const prompt = new LocalizedPrompt(selectActionVisual, selectActionFn)

exports.prompt = prompt
