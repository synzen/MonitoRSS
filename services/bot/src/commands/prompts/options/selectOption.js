const { MenuEmbed, MenuVisual } = require('discord.js-prompts')
const ThemedEmbed = require('../common/utils/ThemedEmbed')
const LocalizedPrompt = require('../common/utils/LocalizedPrompt.js')
const Translator = require('../../../structs/Translator.js')
const getConfig = require('../../../config.js').get

/**
 * @typedef {Object} Data
 * @property {import('../../../structs/db/Profile.js')} [profile]
 * @property {import('../../../structs/db/Feed.js')[]} feeds
 */

/**
 * @param {Data} data
 */
function selectOptionVisual (data) {
  const { locale } = data.profile || {}
  const config = getConfig()
  const translate = Translator.createLocaleTranslator(locale)
  const embed = new ThemedEmbed({
    title: translate('commands.options.miscFeedOptions'),
    description: translate('commands.options.selectOption')
  })
  const ENABLED_TRANSLATED = translate('generics.enabledLower')
  const DISABLED_TRANSLATED = translate('generics.disabledLower')
  const menu = new MenuEmbed(embed)
    .addOption(translate('commands.options.imagePreviewsToggle'), `${translate('generics.defaultSetting', {
      value: config.feeds.imgPreviews === false ? DISABLED_TRANSLATED : ENABLED_TRANSLATED
    })} ${translate('commands.options.imagePreviewsDescription')}`)
    .addOption(translate('commands.options.imageLinksExistenceToggle'), `${translate('generics.defaultSetting', {
      value: config.feeds.imgLinksExistence === false ? DISABLED_TRANSLATED : ENABLED_TRANSLATED
    })} ${translate('commands.options.imageLinksExistenceDescription')}`)
    .addOption(translate('commands.options.dateChecksToggle'), `${translate('generics.defaultSetting', {
      value: config.feeds.checkDates === false ? DISABLED_TRANSLATED : ENABLED_TRANSLATED
    })} ${translate('commands.options.dateChecksDescription', { cycleMaxAge: config.feeds.cycleMaxAge })}`)
    .addOption(translate('commands.options.tableFormattingToggle'), `${translate('generics.defaultSetting', {
      value: config.feeds.formatTables === false ? DISABLED_TRANSLATED : ENABLED_TRANSLATED
    })} ${translate('commands.options.tableFormattingDescription')}`)
    .addOption(translate('commands.options.directSubscribersToggle'), `${translate('generics.defaultSetting', {
      value: config.feeds.directSubscribers === false ? DISABLED_TRANSLATED : ENABLED_TRANSLATED
    })} ${translate('commands.options.directSubscribersDescription')}`)
  const visual = new MenuVisual(menu)
  return visual
}

/**
 * @param {import('discord.js').Message} message
 * @param {Data} data
 */
async function selectOptionFn (message, data) {
  const { content } = message
  let optionKey
  if (content === '1') {
    optionKey = 'imgPreviews'
  } else if (content === '2') {
    optionKey = 'imgLinksExistence'
  } else if (content === '3') {
    optionKey = 'checkDates'
  } else if (content === '4') {
    optionKey = 'formatTables'
  } else if (content === '5') {
    optionKey = 'directSubscribers'
  }
  return {
    ...data,
    optionKey
  }
}

const prompt = new LocalizedPrompt(selectOptionVisual, selectOptionFn)

exports.prompt = prompt
