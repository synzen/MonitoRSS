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

function escapeBackticks (str) {
  return str.replace('`', '​`') // Replace backticks with zero-width space and backtick to escape
}

/**
 * @param {Data} data
 */
function inputPrependCharacterVisual (data) {
  const { profile, selectedFeed: feed } = data
  const translate = Translator.createProfileTranslator(profile)
  const config = getConfig()
  const prefix = profile && profile.prefix ? profile.prefix : config.bot.prefix
  if (!feed.split.prepend) {
    return new MessageVisual(`${translate('commands.split.resetPrependChar', {
      link: feed.url
    })} ${translate('generics.backupReminder', { prefix })}`)
  } else {
    return new MessageVisual(`${translate('commands.split.setPrependChar', {
      link: feed.url,
      content: escapeBackticks(feed.split.prepend)
    })} ${translate('generics.backupReminder', { prefix })}`)
  }
}

const prompt = new LocalizedPrompt(inputPrependCharacterVisual)

exports.prompt = prompt
