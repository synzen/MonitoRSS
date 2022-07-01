const { MessageVisual } = require('discord.js-prompts')
const LocalizedPrompt = require('../common/utils/LocalizedPrompt.js')
const Translator = require('../../../structs/Translator.js')
const getConfig = require('../../../config.js').get

/**
 * @typedef {Object} Data
 * @property {import('../../../structs/db/Profile.js')} [profile]
 * @property {import('../../../structs/db/Feed.js')[]} feeds
 * @property {import('../../../structs/db/Feed.js')} selectedFeed
 */

/**
 * @param {Data} data
 */
function inputAppendCharacterVisual (data) {
  const { profile, selectedFeed: feed } = data
  const translate = Translator.createProfileTranslator(profile)
  const config = getConfig()
  const prefix = profile && profile.prefix ? profile.prefix : config.bot.prefix
  if (!feed.split.maxLength) {
    return new MessageVisual(`${translate('commands.split.resetMaxLen', {
      link: feed.url
    })} ${translate('generics.backupReminder', { prefix })}`)
  } else {
    return new MessageVisual(`${translate('commands.split.setMaxLen', {
      link: feed.url,
      num: feed.split.maxLength
    })} ${translate('generics.backupReminder', { prefix })}`)
  }
}

const prompt = new LocalizedPrompt(inputAppendCharacterVisual)

exports.prompt = prompt
