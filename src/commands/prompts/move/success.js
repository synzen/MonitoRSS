const { MessageVisual } = require('discord.js-prompts')
const LocalizedPrompt = require('../common/utils/LocalizedPrompt.js')
const Translator = require('../../../structs/Translator.js')
const getConfig = require('../../../config.js').get

/**
 * @typedef {Object} Data
 * @property {import('../../../structs/db/Feed.js')[]} feeds
 * @property {import('../../../structs/db/Profile.js')} profile
 * @property {import('../../../structs/db/Feed.js')[]} selectedFeeds
 * @property {import('discord.js').TextChannel} destinationChannel
 */

/**
 * @param {Data} data
 */
function successVisual (data) {
  const { profile, selectedFeeds, destinationChannel } = data
  const translate = Translator.createProfileTranslator(profile)
  const config = getConfig()
  const prefix = profile && profile.prefix ? profile.prefix : config.bot.prefix
  const summary = []
  for (const feed of selectedFeeds) {
    summary.push(`<${feed.url}>`)
  }
  return new MessageVisual(`${translate('commands.move.moveSuccess', {
    summary: summary.join('\n'),
    id: destinationChannel.id
  })} ${translate('generics.backupReminder', { prefix })}`)
}

const prompt = new LocalizedPrompt(successVisual)

exports.prompt = prompt
