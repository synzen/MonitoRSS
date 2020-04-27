const { Rejection, MessageVisual } = require('discord.js-prompts')
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
function addFieldVisual (data) {
  const { profile } = data
  const translate = Translator.createProfileTranslator(profile)
  return new MessageVisual(translate('commands.embed.embedFieldsSettingPrompt'))
}

/**
 * @param {import('discord.js').Message} message
 * @param {Data} data
 */
async function addFieldFn (message, data) {
  const { profile, targetEmbedIndex, selectedFeed: feed, selected } = data
  const { content } = message
  const translate = Translator.createProfileTranslator(profile)
  const split = content.trim().split('\n')
  const name = split[0].trim()
  const value = split.slice(1, split.length).join('\n').trim()
  if (name.length > 256) {
    throw new Rejection(translate('commands.embed.embedFieldsSettingTitleLong'))
  }
  if (value.length > 1024) {
    throw new Rejection(translate('commands.embed.embedFieldsSettingValueLong'))
  }
  if (!feed.embeds[targetEmbedIndex]) {
    feed.embeds[targetEmbedIndex] = {
      fields: []
    }
  }
  const newField = {
    name,
    value: value || '\u200b',
    inline: selected === '2'
  }
  feed.embeds[targetEmbedIndex].fields.push(newField)
  await feed.save()
  const log = createLogger(message.client.shard.ids[0])
  log.info({
    guild: message.guild,
    user: message.author
  }, `Embed field added. Title: '${name}', Value: '${value}'`)
  return {
    ...data,
    newField
  }
}

const prompt = new LocalizedPrompt(addFieldVisual, addFieldFn)

exports.prompt = prompt
