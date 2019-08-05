const log = require('../util/logger.js')
const config = require('../config.js')
const dbOpsGuilds = require('../util/db/guilds.js')
const storage = require('../util/storage.js')
const Translator = require('../structs/Translator.js')

module.exports = async (bot, message) => {
  const locale = message.content.split(' ')[1]
  try {
    let guildRss = await dbOpsGuilds.get(message.guild.id)
    const translate = Translator.createLocaleTranslator(guildRss ? guildRss.locale : undefined)
    const prefix = guildRss && guildRss.prefix ? guildRss.prefix : config.bot.prefix
    const localeList = Translator.getLocales()

    if (!locale) {
      return await message.channel.send(translate('commands.rsslocale.helpText', { prefix, localeList: localeList.join('`, `') }))
    }

    if (!localeList.includes(locale)) {
      return await message.channel.send(translate('commands.rsslocale.setNone', { prefix, locale, localeList: localeList.join('`, `') }))
    }

    // Reset
    if (locale === 'reset') {
      if (!guildRss || !guildRss.locale) {
        return await message.channel.send(translate('commands.rsslocale.resetNone'))
      }
      delete guildRss.locale
      await dbOpsGuilds.update(guildRss, true)
      return await message.channel.send(translate('commands.rsslocale.resetSuccess', { locale: config.bot.locale }))
    }
    if (config.bot.locale === locale) {
      return await message.channel.send(translate('commands.rsslocale.resetNoDefault', { locale }))
    }

    if (!guildRss) guildRss = { id: message.guild.id, name: message.guild.name, locale }
    else guildRss.locale = locale

    await dbOpsGuilds.update(guildRss)
    await message.channel.send(translate('commands.rsslocale.setSuccess', { locale }))
    storage.prefixes[guildRss.id] = locale
  } catch (err) {
    log.command.warning(`rsslocale`, message.guild, err)
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.command.warning('rsslocale 1', message.guild, err))
  }
}
