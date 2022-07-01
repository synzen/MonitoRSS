const { MessageVisual } = require('discord.js-prompts')
const LocalizedPrompt = require('../common/utils/LocalizedPrompt.js')
const Translator = require('../../../structs/Translator.js')
const getConfig = require('../../../config.js').get

/**
 * @typedef {Object} Data
 * @property {import('../../../structs/db/Profile.js')} [profile]
 * @property {import('../../../structs/db/Feed.js')[]} feeds
 * @property {string} optionKey
 * @property {import('../../../structs/db/Feed.js')} selectedFeed
 */

/**
 * @param {Data} data
 */
function successVisual (data) {
  const { profile, optionKey, selectedFeed: feed } = data
  const config = getConfig()
  const translate = Translator.createProfileTranslator(profile)
  const prefix = profile && profile.prefix ? profile.prefix : config.bot.prefix

  let optionName
  if (optionKey === 'imgPreviews') {
    optionName = translate('commands.options.imagePreviews')
  } else if (optionKey === 'imgLinksExistence') {
    optionName = translate('commands.options.imageLinksExistence')
  } else if (optionKey === 'checkDates') {
    optionName = translate('commands.options.dateChecks')
  } else if (optionKey === 'formatTables') {
    optionName = translate('commands.options.tableFormatting')
  } else if (optionKey === 'directSubscribers') {
    optionName = translate('commands.options.directSubscribers')
  }
  const finalState = typeof feed[optionKey] === 'boolean' ? feed[optionKey] : config.feeds[optionKey]
  return new MessageVisual(`${translate('commands.options.settingChanged', {
    propName: optionName,
    isDefault: typeof feed[optionKey] !== 'boolean' ? ` (${translate('commands.options.defaultSetting')})` : '',
    link: feed.url,
    finalSetting: finalState ? translate('generics.enabledLower') : translate('generics.disabledLower')
  })} ${translate('generics.backupReminder', { prefix })}`)
}

const prompt = new LocalizedPrompt(successVisual)

exports.prompt = prompt
