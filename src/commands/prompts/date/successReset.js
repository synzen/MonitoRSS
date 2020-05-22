const { MessageVisual } = require('discord.js-prompts')
const LocalizedPrompt = require('../common/utils/LocalizedPrompt.js')
const Translator = require('../../../structs/Translator.js')

/**
 * @typedef {Object} Data
 * @property {import('../../../structs/db/Profile.js')} [profile]
 * @property {import('../../../structs/db/Feed.js')[]} feeds
 * @property {import('../../../structs/db/Feed.js')} [selectedFeed]
 * @property {string} selected
 */

/**
 * @param {Data} data
 */
function successResetVisual (data) {
  const { profile } = data
  const { locale } = profile || {}
  const translate = Translator.createLocaleTranslator(locale)
  return new MessageVisual(translate('commands.date.successResetAll'))
}

const successResetCondition = data => data.selected === '4'
const prompt = new LocalizedPrompt(successResetVisual, undefined, successResetCondition)

exports.prompt = prompt
