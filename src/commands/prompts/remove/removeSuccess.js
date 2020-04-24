const { DiscordPrompt, MessageVisual } = require('discord.js-prompts')
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
  const removed = `${translate('commands.remove.success')}\n\`\`\`\n\n${selectedFeeds.map(f => f.url).join('\n')}`
  return new MessageVisual(`${removed}\`\`\`\n\n${translate('generics.backupReminder', {
    prefix
  })}`)
}

const prompt = new DiscordPrompt(removeSuccessVisual)

exports.prompt = prompt
