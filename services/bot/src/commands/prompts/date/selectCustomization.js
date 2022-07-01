const { MenuEmbed, MenuVisual } = require('discord.js-prompts')
const ThemedEmbed = require('../common/utils/ThemedEmbed')
const LocalizedPrompt = require('../common/utils/LocalizedPrompt.js')
const Translator = require('../../../structs/Translator.js')
const createLogger = require('../../../util/logger/create.js')
const getConfig = require('../../../config.js').get

/**
 * @typedef {Object} Data
 * @property {import('../../../structs/db/Profile.js')} [profile]
 * @property {import('../../../structs/db/Feed.js')[]} feeds
 * @property {import('../../../structs/db/Feed.js')} [selectedFeed]
 */

/**
 * @param {Data} data
 */
function selectCustomizationVisual (data) {
  const config = getConfig()
  const { profile } = data
  const translate = Translator.createProfileTranslator(profile)
  const embed = new ThemedEmbed({
    title: translate('commands.date.selectTitle'),
    description: translate('commands.date.description')
  })
  const { timezone, dateFormat, dateLanguage } = profile || {}
  const menu = new MenuEmbed(embed)
    .addOption(translate('commands.date.optionChangeTimezone'), `${translate('generics.defaultSetting', { value: config.feeds.timezone })} ${timezone ? translate('commands.date.optionCurrentSetting', { value: timezone }) : ''}`)
    .addOption(translate('commands.date.optionCustomizeFormat'), `${translate('generics.defaultSetting', { value: config.feeds.dateFormat })} ${dateFormat ? translate('commands.date.optionCurrentSetting', { value: dateFormat }) : ''}`)
    .addOption(translate('commands.date.optionChangeLanguage'), `${translate('generics.defaultSetting', { value: config.feeds.dateLanguage })} ${dateLanguage ? translate('commands.date.optionCurrentSetting', { value: dateLanguage }) : ''}`)
    .addOption(translate('commands.date.optionReset'), translate('commands.date.optionResetValue'))

  const visual = new MenuVisual(menu)
  return visual
}

/**
 * @param {import('discord.js').Message} message
 * @param {Data} data
 */
async function selectCustomizationFn (message, data) {
  const { profile } = data
  const { content: selected } = message
  const log = createLogger(message.client.shard.ids[0])
  if (selected === '4') {
    log.info({
      guild: message.guild,
      user: message.author
    }, 'Date settings reset')
    if (profile) {
      profile.timezone = undefined
      profile.dateFormat = undefined
      profile.dateLanguage = undefined
      await profile.save()
    }
  }
  return {
    ...data,
    selected
  }
}

const prompt = new LocalizedPrompt(selectCustomizationVisual, selectCustomizationFn)

exports.prompt = prompt
