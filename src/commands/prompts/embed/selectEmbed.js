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
 */

function listEmbedValues (embed) {
  if (!embed) {
    return '\u200b'
  }
  let val = ''
  for (const prop in embed) {
    if (prop !== 'fields') {
      val += `**${prop}:** ${embed[prop]}\n`
    }
  }
  return val
}

/**
 * @param {Data} data
 */
function selectPropertiesVisual (data) {
  const { profile, selectedFeed: feed } = data
  const embeds = feed.embeds
  const translate = Translator.createProfileTranslator(profile)
  const messageEmbed = new ThemedEmbed()
    .setTitle(translate('commands.embed.embedSelection'))
    .setDescription(translate('commands.embed.embedSelectionDescription'))
  const menu = new MenuEmbed(messageEmbed)

  for (let x = 0; x < embeds.length; ++x) {
    const embed = embeds[x]
    const val = listEmbedValues(embed)
    menu.addOption(translate('commands.embed.numberedEmbed', {
      number: x + 1
    }), `${val}\u200b`)
  }

  if (embeds.length < 10) {
    menu.addOption(translate('commands.embed.embedSelectionOptionAdd'), translate('commands.embed.embedSelectionOptionAddDescription'))
  }

  menu.addOption(translate('commands.embed.embedSelectionOptionRemoveAll'), '\u200b')

  return new MenuVisual(menu)
}

/**
 * @param {import('discord.js').Message} message
 * @param {Data} data
 */
async function selectPropertiesFn (message, data) {
  const { selectedFeed: feed } = data
  const { content } = message
  const targetEmbedIndex = Number(content) - 1
  if (targetEmbedIndex === feed.embeds.length + 1) {
    feed.embeds = []
    if (feed.text === '{empty}') {
      feed.text = undefined
    }
    await feed.save()
    const log = createLogger(message.client.shard.ids[0])
    log.info({
      guild: message.guild,
      user: message.author
    }, `Removed all embeds for ${feed.url}`)
  }
  return {
    ...data,
    targetEmbedIndex
  }
}

const prompt = new LocalizedPrompt(selectPropertiesVisual, selectPropertiesFn)

exports.prompt = prompt
