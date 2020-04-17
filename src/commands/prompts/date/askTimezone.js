const moment = require('moment-timezone')
const { MessageVisual, DiscordPrompt, Rejection } = require('discord.js-prompts')
const Profile = require('../../../structs/db/Profile.js')
const Translator = require('../../../structs/Translator.js')
const createLogger = require('../../../util/logger/create.js')
const getConfig = require('../../../config.js')

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
function askTimezoneVisual (data) {
  const { profile } = data
  const translate = Translator.createProfileTranslator(profile)
  return new MessageVisual(translate('commands.date.promptNewTimezone'))
}

/**
 * @param {import('discord.js').Message} message
 * @param {Data} data
 */
async function askTimezoneFn (message, data) {
  const config = getConfig()
  const { profile } = data
  const { content: setting } = message
  const translate = Translator.createProfileTranslator(profile)
  const log = createLogger(message.client.shard.ids[0])
  // Reset
  if (setting === 'reset') {
    if (profile) {
      profile.timezone = undefined
      await profile.save()
    }
    log.info({
      guild: message.guild,
      user: message.author
    }, 'Timezone reset')
    return data
  }
  // Not reset
  if (!moment.tz.zone(setting)) {
    throw new Rejection(translate('commands.date.invalidTimezone', { input: setting }))
  }
  const isDefault = config.feeds.timezone === setting
  if (profile) {
    profile.timezone = isDefault ? undefined : setting
    await profile.save()
  } else if (!isDefault) {
    const newProfile = new Profile()
    await newProfile.save()
    newProfile.timezone = setting
  }
  log.info({
    guild: message.guild,
    user: message.author
  }, `Timezone set to ${setting}`)
  return {
    ...data,
    setting
  }
}
const askTimezoneCondition = data => data.selected === '1'
const prompt = new DiscordPrompt(askTimezoneVisual, askTimezoneFn, askTimezoneCondition)

exports.prompt = prompt
