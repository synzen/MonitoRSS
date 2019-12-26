const config = require('../config.js')
const moment = require('moment-timezone')
const MenuUtils = require('../structs/MenuUtils.js')
const log = require('../util/logger.js')
const Translator = require('../structs/Translator.js')
const GuildProfile = require('../structs/db/GuildProfile.js')

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
    desc = translate('commands.rssdate.promptNewLanguage', { localesList })
  } else if (num === 2) {
    desc = translate('commands.rssdate.promptNewDateFormat')
  } else if (num === 1) {
    desc = translate('commands.rssdate.promptNewTimezone')
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

  const settingName = num === 3 ? translate('commands.rssdate.dateLanguage') : num === 2 ? translate('commands.rssdate.dateFormat') : translate('commands.rssdate.timezone')

  if (settingLow === 'reset') {
    return { ...data, settingName, setting }
  }

  if (num === 3) {
    if (!locales.includes(setting)) throw new MenuUtils.MenuOptionError(translate('commands.rssdate.invalidLanguage', { input: setting, localesList }))
    return { ...data, settingName, setting }
  } else if (num === 2) {
    return { ...data, settingName, setting }
  } else if (num === 1) {
    if (!moment.tz.zone(setting)) throw new MenuUtils.MenuOptionError(translate('commands.rssdate.invalidTimezone', { input: setting }))
    return { ...data, settingName, setting }
  }
}

module.exports = async (bot, message) => {
  try {
    const profile = await GuildProfile.get(message.guild.id)
    const feeds = profile ? await profile.getFeeds() : []
    const guildLocale = profile ? profile.locale : undefined
    const translate = Translator.createLocaleTranslator(guildLocale)
    if (feeds.length === 0) {
      return message.channel.send(translate('commands.rssdate.noFeeds')).catch(err => log.command.warning(`rssdate 1:`, message.guild, err))
    }

    const selectOption = new MenuUtils.Menu(message, selectOptionFn).setAuthor('Date Customizations')
      .setDescription(translate('commands.rssdate.description'))
      .addOption(translate('commands.rssdate.optionChangeTimezone'), `${translate('generics.defaultSetting', { value: config.feeds.timezone })} ${profile.timezone ? translate('commands.rssdate.optionCurrentSetting', { value: profile.timezone }) : ''}`)
      .addOption(translate('commands.rssdate.optionCustomizeFormat'), `${translate('generics.defaultSetting', { value: config.feeds.dateFormat })} ${profile.dateFormat ? translate('commands.rssdate.optionCurrentSetting', { value: profile.dateFormat }) : ''}`)
      .addOption(translate('commands.rssdate.optionChangeLanguage'), `${translate('generics.defaultSetting', { value: config.feeds.dateLanguage })} ${profile.dateLanguage ? translate('commands.rssdate.optionCurrentSetting', { value: profile.dateLanguage }) : ''}`)
      .addOption(translate('commands.rssdate.optionReset'), translate('commands.rssdate.optionResetValue'))

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

      log.command.info(`Date settings resetting to default`, message.guild)
      await profile.save()
      return await message.channel.send(translate('commands.rssdate.successResetAll'))
    }

    if (setting.toLowerCase() === 'reset') {
      if (num === 3) {
        profile.dateLanguage = undefined
      } else if (num === 2) {
        profile.dateFormat = undefined
      } else {
        profile.timezone = undefined
      }

      log.command.info(`Date setting ${settingName} resetting to default`, message.guild)
      await profile.save()
      await message.channel.send(translate('commands.rssdate.successReset', { name: settingName, value: config.feeds[num === 3 ? 'dateLanguage' : num === 2 ? 'dateFormat' : 'timezone'] }))
    } else {
      if (num === 3) {
        profile.dateLanguage = setting.toLowerCase() === config.feeds.dateLanguage.toLowerCase() ? undefined : setting
      } else if (num === 2) {
        profile.dateFormat = setting.toLowerCase() === config.feeds.dateFormat ? undefined : setting
      } else if (num === 1) {
        profile.timezone = setting.toLowerCase() === config.feeds.timezone.toLowerCase() ? undefined : setting
      }

      log.command.info(`Date setting ${settingName} updating to '${setting}'`, message.guild)
      await profile.save()
      await message.channel.send(translate('commands.rssdate.successSet', { name: settingName, value: setting }))
    }
  } catch (err) {
    log.command.warning(`rssdate`, message.guild, err)
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.command.warning('rssdate 1', message.guild, err))
  }
}
