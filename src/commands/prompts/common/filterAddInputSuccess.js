const { MessageVisual } = require('discord.js-prompts')
const LocalizedPrompt = require('./utils/LocalizedPrompt')
const Subscriber = require('../../../structs/db/Subscriber.js')
const Translator = require('../../../structs/Translator.js')
const getConfig = require('../../../config.js').get

/**
 * @typedef {Object} Data
 * @property {import('../../../structs/db/Profile.js')} [profile]
 * @property {import('../../../structs/db/Feed.js')[]} feeds
 * @property {import('../../../structs/db/Feed.js')} [selectedFeed]
 * @property {string} filterCategory
 * @property {import('../../../structs/db/Feed.js')|import('../../../structs/db/Subscriber.js')} target
 * @property {string[]} addedInputFilters
 * @property {string[]} skippedInputFilters
 */

/**
 * @param {Data} data
 */
function visual (data) {
  const { filterCategory, profile, addedInputFilters, skippedInputFilters, target } = data
  const config = getConfig()
  const prefix = profile && profile.prefix ? profile.prefix : config.bot.prefix
  const translate = Translator.createProfileTranslator(profile)
  let output = ''
  if (addedInputFilters.length > 0) {
    if (target instanceof Subscriber) {
      output += `${translate('commands.utils.filters.updatedFor', {
        name: target.type
      })} `
    }
    output = `${translate('commands.utils.filters.addSuccess')} \`${filterCategory}\`:\n\`\`\`\n\n${addedInputFilters.join('\n')}\`\`\``
  }
  if (skippedInputFilters.length > 0) {
    output += `\n${translate('commands.utils.filters.addFailed')}:\n\`\`\`\n\n${skippedInputFilters.join('\n')}\`\`\``
  }
  if (addedInputFilters.length > 0) {
    output += translate('commands.utils.filters.testFilters', {
      prefix
    })
  }
  return new MessageVisual(`${output}\n\n${translate('generics.backupReminder', {
    prefix
  })}`)
}

const prompt = new LocalizedPrompt(visual)

exports.prompt = prompt
