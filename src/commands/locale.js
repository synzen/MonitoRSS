const log = require('../util/logger.js')
const config = require('../config.js')
const Translator = require('../structs/Translator.js')
const GuildProfile = require('../structs/db/GuildProfile.js')

module.exports = async (bot, message) => {
  const locale = message.content.split(' ')[1]
  try {
    const profile = await GuildProfile.get(message.guild.id)
    const guildLocale = profile ? profile.locale : undefined
    const translate = Translator.createLocaleTranslator(guildLocale)
    const prefix = profile && profile.prefix ? profile.prefix : config.bot.prefix
    const localeList = Translator.getLocales()

    localeList.splice(localeList.indexOf(config.bot.locale), 1)
    const printLocaleList = localeList.join('`, `')
    if (!locale) {
      return await message.channel.send(translate('commands.locale.helpText', { prefix, localeList: printLocaleList }))
    }

    if (guildLocale === locale) {
      return await message.channel.send(translate('commands.locale.alreadySet', { locale }))
    }

    if (locale !== 'reset' && !localeList.includes(locale)) {
      return await message.channel.send(translate('commands.locale.setNone', { prefix, locale, localeList: printLocaleList }))
    }

    // Reset
    if (locale === 'reset') {
      if (!profile || !profile.locale) {
        return await message.channel.send(translate('commands.locale.resetNone'))
      }
      profile.locale = undefined
      await profile.save()
      return await message.channel.send(Translator.translate('commands.locale.resetSuccess', config.bot.locale, { locale: config.bot.locale }))
    }

    if (config.bot.locale === locale) {
      return await message.channel.send(translate('commands.locale.resetNoDefault', { locale, prefix }))
    }

    if (!profile) {
      const newProfile = new GuildProfile({
        _id: message.guild.id,
        name: message.guild.name,
        locale
      })
      await newProfile.save()
    } else {
      profile.locale = locale
      await profile.save()
    }

    await message.channel.send(Translator.translate('commands.locale.setSuccess', locale, { locale }))
  } catch (err) {
    log.command.warning(`rsslocale`, message.guild, err)
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.command.warning('rsslocale 1', message.guild, err))
  }
}
