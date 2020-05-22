const { MessageVisual } = require('discord.js-prompts')
const LocalizedPrompt = require('../common/utils/LocalizedPrompt.js')
const Translator = require('../../../structs/Translator.js')
const getConfig = require('../../../config.js').get

/**
 * @typedef {Object} Data
 * @property {import('../../../structs/db/Profile.js')} [profile]
 * @property {import('../../../structs/db/Feed.js')[]} feeds
 * @property {import('../../../structs/db/Feed.js')} [selectedFeed]
 * @property {string} selected
 * @property {string} setting
 */

/**
 * @param {Data} data
 */
function successFormatVisual (data) {
  const config = getConfig()
  const { profile, setting } = data
  const translate = Translator.createProfileTranslator(profile)
  if (setting === 'reset') {
    return new MessageVisual(translate('commands.date.successReset', {
      name: translate('commands.date.dateFormat'),
      value: config.feeds.dateFormat
    }))
  } else {
    return new MessageVisual(translate('commands.date.successSet', {
      name: translate('commands.date.dateFormat'),
      value: setting
    }))
  }
}

const prompt = new LocalizedPrompt(successFormatVisual)

exports.prompt = prompt
