const { Rejection, MessageVisual } = require('discord.js-prompts')
const LocalizedPrompt = require('../common/utils/LocalizedPrompt.js')
const Translator = require('../../../structs/Translator.js')
const referenceProperties = [
  'message',
  'filters',
  'misc-options',
  'subscribers',
  'comparisons',
  'regexops',
  'filtered-formats',
  'webhook',
  'all'
]

/**
 * @typedef {Object} Data
 * @property {import('../../../structs/db/Feed.js')[]} feeds
 * @property {import('../../../structs/db/Profile.js')} profile
 * @property {import('../../../structs/db/Feed.js')} sourceFeed
 * @property {import('../../../structs/db/Feed.js')[]} destinationFeeds
 */

/**
 * @param {Data} data
 */
function selectPropertiesVisual (data) {
  const { profile } = data
  const translate = Translator.createProfileTranslator(profile)

  return new MessageVisual(translate('commands.clone.inputProperties', {
    properties: referenceProperties.join('`, `')
  }))
}
/**
 * @param {import('discord.js').Message} message
 * @param {Data} data
 */
async function selectDestinationFeedsFn (message, data) {
  const { profile } = data
  const { content } = message
  const translate = Translator.createProfileTranslator(profile)
  const split = content
    .split(',')
    .map(s => s.trim())
    .filter((value, index, self) => self.indexOf(value) === index)
  const invalids = []
  for (const str of split) {
    const lowercased = str.toLowerCase()
    if (!referenceProperties.includes(lowercased)) {
      invalids.push(str)
    }
  }
  if (invalids.length > 0) {
    throw new Rejection(translate('commands.clone.invalidProperties', {
      invalid: invalids.join('`, `'),
      properties: referenceProperties.join('`, `')
    }))
  }
  return {
    ...data,
    properties: split.map(s => s.toLowerCase())
  }
}

const prompt = new LocalizedPrompt(selectPropertiesVisual, selectDestinationFeedsFn)

exports.prompt = prompt
