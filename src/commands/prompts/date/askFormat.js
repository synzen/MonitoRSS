const { MessageVisual } = require('discord.js-prompts')
const LocalizedPrompt = require('../common/utils/LocalizedPrompt.js')
const Profile = require('../../../structs/db/Profile.js')
const Translator = require('../../../structs/Translator.js')
const createLogger = require('../../../util/logger/create.js')
const getConfig = require('../../../config.js').get

/**
 * @typedef {Object} Data
 * @property {import('../../../structs/db/Profile.js')} [profile]
 * @property {import('../../../structs/db/Feed.js')[]} feeds
 * @property {import('../../../structs/db/Feed.js')} [selectedFeed]
 * @property {string} selected
 */

/**
 * @param {Data} data
 */
function askFormatVisual (data) {
  const { profile } = data
  const { locale } = profile || {}
  const translate = Translator.createLocaleTranslator(locale)
  return new MessageVisual(translate('commands.date.promptNewDateFormat'))
}

/**
 * @param {import('discord.js').Message} message
 * @param {Data} data
 */
async function askFormatFn (message, data) {
  const config = getConfig()
  const { profile } = data
  const { content: setting } = message
  const log = createLogger(message.client.shard.ids[0])
  // Reset
  if (setting === 'reset') {
    if (profile) {
      profile.dateFormat = undefined
      await profile.save()
    }
    log.info({
      guild: message.guild,
      user: message.author
    }, 'Date format reset')
    return data
  }
  // Not reset
  const isDefault = setting === config.feeds.dateFormat
  if (profile) {
    profile.dateFormat = isDefault ? undefined : setting
    await profile.save()
  } else if (!isDefault) {
    const newProfile = new Profile()
    await newProfile.save()
    newProfile.dateFormat = setting
  }
  log.info({
    guild: message.guild,
    user: message.author
  }, `Date format set to ${setting}`)
  return {
    ...data,
    setting
  }
}

const prompt = new LocalizedPrompt(askFormatVisual, askFormatFn)

exports.prompt = prompt
