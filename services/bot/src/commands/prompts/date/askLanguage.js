const moment = require('moment-timezone')
const { MessageVisual, Rejection } = require('discord.js-prompts')
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
function askLanguageVisual (data) {
  const { profile } = data
  const translate = Translator.createProfileTranslator(profile)
  const locales = moment.locales()
  const localesList = locales.join(', ')
  return new MessageVisual(translate('commands.date.promptNewLanguage', { localesList }))
}

/**
 * @param {import('discord.js').Message} message
 * @param {Data} data
 */
async function askLanguageFn (message, data) {
  const config = getConfig()
  const { profile } = data
  const { content: setting } = message
  const translate = Translator.createProfileTranslator(profile)
  const log = createLogger(message.client.shard.ids[0])
  // Reset
  if (setting === 'reset') {
    if (profile) {
      profile.dateLanguage = undefined
      await profile.save()
    }
    log.info({
      guild: message.guild,
      user: message.author
    }, 'Date language reset')
    return data
  }
  const locales = moment.locales()
  if (!locales.includes(setting)) {
    throw new Rejection(translate('commands.date.invalidLanguage', {
      input: setting,
      localesList: locales.join(', ')
    }))
  }
  // Not reset
  const isDefault = config.bot.dateLanguage === setting
  if (profile) {
    profile.dateLanguage = isDefault ? undefined : setting
    await profile.save()
  } else if (!isDefault) {
    const newProfile = new Profile()
    newProfile.dateLanguage = setting
    newProfile.name = message.guild.name
    await newProfile.save()
  }
  log.info({
    guild: message.guild,
    user: message.author
  }, `Date language set to ${setting}`)
  return {
    ...data,
    setting
  }
}

const prompt = new LocalizedPrompt(askLanguageVisual, askLanguageFn)

exports.prompt = prompt
