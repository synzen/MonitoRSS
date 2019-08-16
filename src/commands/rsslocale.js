const log = require('../util/logger.js')
const config = require('../config.js')
const dbOpsGuilds = require('../util/db/guilds.js')
const Translator = require('../structs/Translator.js')

module.exports = async (bot, message) => {
  const locale = message.content.split(' ')[1]
  try {
    let guildRss = await dbOpsGuilds.get(message.guild.id)
    const guildLocale = guildRss ? guildRss.locale : undefined
    const translate = Translator.createLocaleTranslator(guildLocale)
    const prefix = guildRss && guildRss.prefix ? guildRss.prefix : config.bot.prefix
    const localeList = Translator.getLocales()

    localeList.splice(localeList.indexOf(config.bot.locale), 1)
    const printLocaleList = localeList.join('`, `')
    if (!locale) {
      return await message.channel.send(translate('commands.rsslocale.helpText', { prefix, localeList: printLocaleList }))
    }

    if (guildLocale === locale) {
      return await message.channel.send(translate('commands.rsslocale.alreadySet', { locale }))
    }

    if (locale !== 'reset' && !localeList.includes(locale)) {
      return await message.channel.send(translate('commands.rsslocale.setNone', { prefix, locale, localeList: printLocaleList }))
    }

    // Reset
    if (locale === 'reset') {
      if (!guildRss || !guildRss.locale) {
        return await message.channel.send(translate('commands.rsslocale.resetNone'))
      }
      delete guildRss.locale
      await dbOpsGuilds.update(guildRss)
      return await message.channel.send(Translator.translate('commands.rsslocale.resetSuccess', config.bot.locale, { locale: config.bot.locale }))
    }

    if (config.bot.locale === locale) {
      return await message.channel.send(translate('commands.rsslocale.resetNoDefault', { locale, prefix }))
    }

    if (!guildRss) guildRss = { id: message.guild.id, name: message.guild.name, locale }
    else guildRss.locale = locale

    await dbOpsGuilds.update(guildRss)
    await message.channel.send(Translator.translate('commands.rsslocale.setSuccess', locale, { locale }))
  } catch (err) {
    log.command.warning(`rsslocale`, message.guild, err)
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.command.warning('rsslocale 1', message.guild, err))
  }
}
