const moment = require('moment-timezone')
const MenuUtils = require('../structs/MenuUtils.js')
const Translator = require('../structs/Translator.js')
const Profile = require('../structs/db/Profile.js')
const Feed = require('../structs/db/Feed.js')
const getConfig = require('../config.js').get
const createLogger = require('../util/logger/create.js')

async function selectOptionFn (m, data) {
  const translate = data.translate
  const input = m.content
  const num = parseInt(input, 10)

  if (isNaN(num) || num <= 0 || num > 4) {
    throw new MenuUtils.MenuOptionError()
  }

  if (num === 4) {
    return { num }
  }

  // Message collector for options 1, 2 and 3
  let desc = ''
  let locales = []
  let localesList = ''
  if (num === 3) {
    locales = moment.locales()
    localesList = locales.join(', ')
    desc = translate('commands.date.promptNewLanguage', { localesList })
  } else if (num === 2) {
    desc = translate('commands.date.promptNewDateFormat')
  } else if (num === 1) {
    desc = translate('commands.date.promptNewTimezone')
  }

  const setOption = new MenuUtils.Menu(m, setOptionFn)

  return { ...data,
    num: num,
    locales: locales,
    localesList: localesList,
    next: {
      text: desc,
      embed: null,
      menu: setOption
    } }
}

async function setOptionFn (m, data) {
  const { num, locales, localesList, translate } = data
  const setting = m.content
  const settingLow = setting.toLowerCase()

  const settingName = num === 3 ? translate('commands.date.dateLanguage') : num === 2 ? translate('commands.date.dateFormat') : translate('commands.date.timezone')

  if (settingLow === 'reset') {
    return { ...data, settingName, setting }
  }

  if (num === 3) {
    if (!locales.includes(setting)) throw new MenuUtils.MenuOptionError(translate('commands.date.invalidLanguage', { input: setting, localesList }))
    return { ...data, settingName, setting }
  } else if (num === 2) {
    return { ...data, settingName, setting }
  } else if (num === 1) {
    if (!moment.tz.zone(setting)) throw new MenuUtils.MenuOptionError(translate('commands.date.invalidTimezone', { input: setting }))
    return { ...data, settingName, setting }
  }
}

module.exports = async (message) => {
  const profile = await Profile.get(message.guild.id)
  const feeds = await Feed.getManyBy('guild', message.guild.id)
  const guildLocale = profile ? profile.locale : undefined
  const translate = Translator.createLocaleTranslator(guildLocale)
  const log = createLogger(message.guild.shard.id)
  if (feeds.length === 0) {
    await message.channel.send(translate('commands.date.noFeeds'))
  }
  const config = getConfig()
  const selectOption = new MenuUtils.Menu(message, selectOptionFn).setAuthor('Date Customizations')
    .setDescription(translate('commands.date.description'))
    .addOption(translate('commands.date.optionChangeTimezone'), `${translate('generics.defaultSetting', { value: config.feeds.timezone })} ${profile.timezone ? translate('commands.date.optionCurrentSetting', { value: profile.timezone }) : ''}`)
    .addOption(translate('commands.date.optionCustomizeFormat'), `${translate('generics.defaultSetting', { value: config.feeds.dateFormat })} ${profile.dateFormat ? translate('commands.date.optionCurrentSetting', { value: profile.dateFormat }) : ''}`)
    .addOption(translate('commands.date.optionChangeLanguage'), `${translate('generics.defaultSetting', { value: config.feeds.dateLanguage })} ${profile.dateLanguage ? translate('commands.date.optionCurrentSetting', { value: profile.dateLanguage }) : ''}`)
    .addOption(translate('commands.date.optionReset'), translate('commands.date.optionResetValue'))

  const data = await new MenuUtils.MenuSeries(message, [selectOption], { profile, locale: guildLocale, translate }).start()
  if (!data) {
    return
  }
  const { num, settingName, setting } = data

  if (num === 4) {
    // null marks for deletion
    profile.timezone = undefined
    profile.dateFormat = undefined
    profile.dateLanguage = undefined

    log.info({
      guild: message.guild
    }, `Date settings resetting to default`)
    await profile.save()
    return message.channel.send(translate('commands.date.successResetAll'))
  }

  if (setting.toLowerCase() === 'reset') {
    if (num === 3) {
      profile.dateLanguage = undefined
    } else if (num === 2) {
      profile.dateFormat = undefined
    } else {
      profile.timezone = undefined
    }

    log.info({
      guild: message.guild
    }, `Date setting ${settingName} resetting to default`)
    await profile.save()
    await message.channel.send(translate('commands.date.successReset', {
      name: settingName, value: config.feeds[num === 3 ? 'dateLanguage' : num === 2 ? 'dateFormat' : 'timezone']
    }))
  } else {
    if (num === 3) {
      profile.dateLanguage = setting.toLowerCase() === config.feeds.dateLanguage.toLowerCase() ? undefined : setting
    } else if (num === 2) {
      profile.dateFormat = setting.toLowerCase() === config.feeds.dateFormat ? undefined : setting
    } else if (num === 1) {
      profile.timezone = setting.toLowerCase() === config.feeds.timezone.toLowerCase() ? undefined : setting
    }

    log.info({
      guild: message.guild
    }, `Date setting ${settingName} updating to '${setting}'`)
    await profile.save()
    await message.channel.send(translate('commands.date.successSet', {
      name: settingName,
      value: setting
    }))
  }
}
