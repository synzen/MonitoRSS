const { MessageVisual } = require('discord.js-prompts')
const LocalizedPrompt = require('../common/utils/LocalizedPrompt.js')
const Translator = require('../../../structs/Translator.js')
const getConfig = require('../../../config.js').get

/**
 * @typedef {Object} Data
 * @property {import('../../../structs/db/Profile.js')} [profile]
 * @property {import('../../../structs/db/Feed.js')[]} feeds
 * @property {import('../../../structs/db/Feed.js')} [selectedFeed]
 * @property {number} targetEmbedIndex
 * @property {string[]} properties
 * @property {Object<string, string>} updatedProperties
 */

/**
 * @param {Data} data
 */
function setPropertyVisual (data) {
  const { profile, updatedProperties, selectedFeed: feed } = data
  const config = getConfig()
  const prefix = profile && profile.prefix ? profile.prefix : config.bot.prefix
  const translate = Translator.createProfileTranslator(profile)
  let reset = ''
  let updated = ''
  for (const propertyName in updatedProperties) {
    const setValue = updatedProperties[propertyName]
    if (setValue === 'reset') {
      reset += translate('commands.embed.resetSuccess', {
        propName: propertyName
      })
    } else {
      updated += translate('commands.embed.updatedSuccess', {
        propName: propertyName,
        userSetting: setValue
      })
    }
  }
  return new MessageVisual(`${translate('commands.embed.updatedInfo', {
    link: feed.url,
    resetList: reset,
    updateList: updated,
    prefix
  })} ${translate('generics.backupReminder', { prefix })}`, { split: true })
}

const prompt = new LocalizedPrompt(setPropertyVisual)

exports.prompt = prompt
