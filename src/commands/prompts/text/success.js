const { MessageVisual } = require('discord.js-prompts')
const LocalizedPrompt = require('../common/utils/LocalizedPrompt.js')
const Translator = require('../../../structs/Translator.js')
const getConfig = require('../../../config.js').get

/**
 * @typedef {Object} Data
 * @property {import('../../../structs/db/Feed.js')} selectedFeed
 * @property {import('../../../structs/db/Profile.js')} profile
 */

/**
 * @param {Data} data
 */
function successVisual (data) {
  const config = getConfig()
  const { profile } = data
  const { locale } = profile || {}
  const prefix = profile && profile.prefix ? profile.prefix : config.bot.prefix
  const { text, url } = data.selectedFeed
  const defaultText = config.feeds.defaultText
  const translate = Translator.createLocaleTranslator(locale)
  if (text === undefined) {
    return new MessageVisual(translate('commands.text.resetSuccess', { link: url }) + `\n \`\`\`Markdown\n${defaultText}\`\`\``)
  }
  const confirmSuccess = translate('commands.text.setSuccess', { link: url })
  const escapedText = text.replace('`', '​`')
  const testReminder = translate('commands.text.reminder', { prefix })
  const backupReminder = translate('generics.backupReminder', { prefix })
  const subscriptionsReminder = text.search(/{subscriptions}/) === -1 ? translate('commands.text.noSubscriptionsPlaceholder', { prefix }) : ''
  return new MessageVisual(`${confirmSuccess}\n \`\`\`Markdown\n${escapedText}\`\`\`\n${testReminder} ${backupReminder}${subscriptionsReminder}`)
}

const prompt = new LocalizedPrompt(successVisual)

exports.prompt = prompt
