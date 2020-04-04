const Translator = require('../structs/Translator.js')
const Profile = require('../structs/db/Profile.js')
const getConfig = require('../config.js').get
const createLogger = require('../util/logger/create.js')

module.exports = async (message) => {
  const locale = message.content.split(' ')[1]
  const profile = await Profile.get(message.guild.id)
  const guildLocale = profile ? profile.locale : undefined
  const translate = Translator.createLocaleTranslator(guildLocale)
  const config = getConfig()
  const botLocale = config.bot.locale
  const prefix = profile && profile.prefix ? profile.prefix : config.bot.prefix
  const localeList = Translator.getLocales()

  localeList.splice(localeList.indexOf(botLocale), 1)
  const printLocaleList = localeList.join('`, `')
  const log = createLogger(message.guild.shard.id)

  if (!locale) {
    return message.channel.send(translate('commands.locale.helpText', { prefix, localeList: printLocaleList }))
  }

  if (guildLocale === locale) {
    return message.channel.send(translate('commands.locale.alreadySet', { locale }))
  }

  if (locale !== 'reset' && !localeList.includes(locale)) {
    return message.channel.send(translate('commands.locale.setNone', { prefix, locale, localeList: printLocaleList }))
  }

  // Reset
  if (locale === 'reset') {
    if (!profile || !profile.locale) {
      return message.channel.send(translate('commands.locale.resetNone'))
    }
    profile.locale = undefined
    log.info({
      guild: message.guild
    }, 'Locale reset')
    await profile.save()
    return message.channel.send(Translator.translate('commands.locale.resetSuccess', botLocale, { locale: botLocale }))
  }

  if (botLocale === locale) {
    return message.channel.send(translate('commands.locale.resetNoDefault', { locale, prefix }))
  }

  if (!profile) {
    const newProfile = new Profile({
      _id: message.guild.id,
      name: message.guild.name,
      locale
    })
    await newProfile.save()
  } else {
    profile.locale = locale
    await profile.save()
  }

  log.info({
    guild: message.guild
  }, `Locale changed to ${locale}`)
  await message.channel.send(Translator.translate('commands.locale.setSuccess', locale, { locale }))
}
