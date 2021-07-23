const { Rejection, MessageVisual } = require('discord.js-prompts')
const LocalizedPrompt = require('../common/utils/LocalizedPrompt.js')
const Translator = require('../../../structs/Translator.js')
const createLogger = require('../../../util/logger/create.js')
const Feed = require('../../../structs/db/Feed')

const prettyNames = new Map([
  ['title', 'Title'],
  ['description', 'Description'],
  ['url', 'URL'],
  ['color', 'Color'],
  ['timestamp', 'Timestamp'],
  ['footerIconURL', 'Footer Icon URL'],
  ['footerText', 'Footer Text'],
  ['thumbnailURL', 'Thumbnail URL'],
  ['imageURL', 'Image URL'],
  ['authorName', 'Author Name'],
  ['authorURL', 'Author URL'],
  ['authorIconURL', 'Author Icon URL']
])

/**
 * @typedef {Object} Data
 * @property {import('../../../structs/db/Profile.js')} [profile]
 * @property {import('../../../structs/db/Feed.js')[]} feeds
 * @property {import('../../../structs/db/Feed.js')} [selectedFeed]
 * @property {number} targetEmbedIndex
 * @property {string[]} properties
 * @property {Object<string, string>} [updatedProperties]
 */

/**
 * @param {Data} data
 */
function setPropertyVisual (data) {
  const { profile, properties } = data
  const translate = Translator.createProfileTranslator(profile)

  const thisPropertyKey = properties[0]
  const thisPropertyName = prettyNames.get(thisPropertyKey)
  if (thisPropertyKey === 'timestamp') {
    return new MessageVisual(translate('commands.embed.settingPropertyTimestamp'))
  } else {
    return new MessageVisual(translate('commands.embed.settingProperty', {
      property: thisPropertyName
    }))
  }
}

/**
 * @param {import('discord.js').Message} message
 * @param {Data} data
 */
async function setPropertyFn (message, data) {
  const { profile, properties, targetEmbedIndex, selectedFeed: feed, updatedProperties } = data
  const { content } = message
  const translate = Translator.createProfileTranslator(profile)
  const thisPropertyKey = properties[0]
  const thisPropertyName = prettyNames.get(thisPropertyKey)
  let finalValue = content
  // Validate the property
  if (thisPropertyKey === 'color' && finalValue !== 'reset') {
    finalValue = parseInt(content, 10)
    if (isNaN(finalValue)) {
      throw new Rejection(translate('commands.embed.invalidColorNumber'))
    }
  }
  // Save
  if (finalValue === 'reset' && feed.embeds[targetEmbedIndex]) {
    feed.embeds[targetEmbedIndex][thisPropertyKey] = undefined
  } else {
    if (!feed.embeds[targetEmbedIndex]) {
      feed.embeds.push({})
    }
    feed.embeds[targetEmbedIndex][thisPropertyKey] = finalValue
  }
  feed.validate()
  if (feed.embeds.length === 0 && feed.text === '{empty}') {
    feed.text = undefined
  }
  await feed.save()
  if (feed.disabled === Feed.DISABLE_REASONS.BAD_FORMAT) {
    await feed.enable()
  }

  // Log it
  const log = createLogger()
  log.info({
    guild: message.guild,
    user: message.author
  }, `Embed[${targetEmbedIndex}] property ${thisPropertyKey} updated to ${finalValue}`)

  // Return the data
  const newData = {
    ...data,
    properties: properties.slice(1, properties.length)
  }
  if (!updatedProperties) {
    newData.updatedProperties = {
      [thisPropertyName]: finalValue
    }
  } else {
    newData.updatedProperties = {
      ...updatedProperties,
      [thisPropertyName]: finalValue
    }
  }
  return newData
}

const prompt = new LocalizedPrompt(setPropertyVisual, setPropertyFn)

exports.prompt = prompt
