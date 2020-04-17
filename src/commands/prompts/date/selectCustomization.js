const { MessageEmbed } = require('discord.js')
const { DiscordPrompt, MenuEmbed, MenuVisual } = require('discord.js-prompts')
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
  const embed = new MessageEmbed({
    title: translate('structs.FeedSelector.feedSelectionMenu'),
    description: `${translate('structs.FeedSelector.prompt')} ${translate('structs.FeedSelector.exitToCancel')} `
  })
  const menu = new MenuEmbed(embed)
    .addOption(translate('commands.date.optionChangeTimezone'), `${translate('generics.defaultSetting', { value: config.feeds.timezone })} ${profile.timezone ? translate('commands.date.optionCurrentSetting', { value: profile.timezone }) : ''}`)
    .addOption(translate('commands.date.optionCustomizeFormat'), `${translate('generics.defaultSetting', { value: config.feeds.dateFormat })} ${profile.dateFormat ? translate('commands.date.optionCurrentSetting', { value: profile.dateFormat }) : ''}`)
    .addOption(translate('commands.date.optionChangeLanguage'), `${translate('generics.defaultSetting', { value: config.feeds.dateLanguage })} ${profile.dateLanguage ? translate('commands.date.optionCurrentSetting', { value: profile.dateLanguage }) : ''}`)
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

const prompt = new DiscordPrompt(selectCustomizationVisual, selectCustomizationFn)

exports.prompt = prompt
