const { MessageVisual } = require('discord.js-prompts')
const LocalizedPrompt = require('../common/utils/LocalizedPrompt.js')
const Translator = require('../../../structs/Translator.js')
const getConfig = require('../../../config.js').get

/**
 * @typedef {Object} Data
 * @property {import('../../../structs/db/Feed.js')[]} feeds
 * @property {import('../../../structs/db/Profile.js')} profile
 * @property {import('../../../structs/db/Feed.js')[]} selectedFeeds
 */

/**
 * @param {Data} data
 */
async function removeSuccessVisual (data) {
  const { profile, selectedFeeds } = data
  const config = getConfig()
  const translate = Translator.createProfileTranslator(profile)
  const prefix = profile && profile.prefix ? profile.prefix : config.bot.prefix
  const removed = `${translate('commands.remove.success')}\n\n**${selectedFeeds.map(f => `<${f.url}>`).join('\n')}**`
  return new MessageVisual(`${removed}\n\n${translate('generics.backupReminder', {
    prefix
  })}`, {
    split: true
  })
}

const prompt = new LocalizedPrompt(removeSuccessVisual)

exports.prompt = prompt
