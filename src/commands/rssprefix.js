const log = require('../util/logger.js')
const config = require('../config.js')
const dbOpsGuilds = require('../util/db/guilds.js')
const storage = require('../util/storage.js')
const Translator = require('../structs/Translator.js')

module.exports = async (bot, message) => {
  const prefix = message.content.split(' ')[1]
  try {
    let guildRss = await dbOpsGuilds.get(message.guild.id)
    const translate = Translator.createLocaleTranslator(guildRss ? guildRss.locale : undefined)

    if (!prefix) {
      return await message.channel.send(translate('commands.rssprefix.helpText'))
    }
    // Reset
    if (prefix === 'reset') {
      if (!guildRss || !guildRss.prefix) {
        return await message.channel.send(translate('commands.rssprefix.resetNone'))
      }
      delete guildRss.prefix
      delete storage.prefixes[guildRss.id]
      await dbOpsGuilds.update(guildRss, true)
      return await message.channel.send(translate('commands.rssprefix.resetSuccess', { prefix: config.bot.prefix }))
    }
    if (prefix.length > 4) {
      return await message.channel.send(translate('commands.rssprefix.mustBeLess'))
    }
    if (config.bot.prefix === prefix) {
      return await message.channel.send(translate('commands.rssprefix.cannotUseDefault'))
    }

    if (!guildRss) guildRss = { id: message.guild.id, name: message.guild.name, prefix }
    else guildRss.prefix = prefix

    await dbOpsGuilds.update(guildRss)
    await message.channel.send(translate('commands.rssprefix.setSuccess', { prefix }))
    storage.prefixes[guildRss.id] = prefix
  } catch (err) {
    log.command.warning(`rssprefix`, message.guild, err)
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.command.warning('rssprefix 1', message.guild, err))
  }
}
