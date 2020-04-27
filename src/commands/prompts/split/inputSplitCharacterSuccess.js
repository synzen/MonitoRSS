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
function inputSplitCharacterVisual (data) {
  const { profile, selectedFeed: feed } = data
  const translate = Translator.createProfileTranslator(profile)
  const config = getConfig()
  const prefix = profile && profile.prefix ? profile.prefix : config.bot.prefix
  if (!feed.split.char) {
    return new MessageVisual(`${translate('commands.split.resetSplitChar', {
      link: feed.url
    })} ${translate('generics.backupReminder', { prefix })}`)
  } else {
    return new MessageVisual(`${translate('commands.split.setSplitChar', {
      link: feed.url,
      content: feed.split.char
    })} ${translate('generics.backupReminder', { prefix })}`)
  }
}

const prompt = new LocalizedPrompt(inputSplitCharacterVisual)

exports.prompt = prompt
