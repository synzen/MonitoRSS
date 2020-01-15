const GuildData = require('../structs/GuildData.js')
const Attachment = require('discord.js').Attachment
const Translator = require('../structs/Translator.js')
const log = require('../util/logger.js')

module.exports = async (bot, message, automatic) => { // automatic indicates invokation by the bot
  try {
    const guildId = message.guild.id
    const guildData = await GuildData.get(guildId)
    const locale = guildData.profile ? guildData.profile.locale : undefined
    const translate = Translator.createLocaleTranslator(locale)
    if (guildData.isEmpty() && !automatic) {
      return await message.channel.send(translate('commands.backup.noProfile'))
    }
    if (message.guild.me.permissionsIn(message.channel).has('ATTACH_FILES')) {
      const data = Buffer.from(JSON.stringify(guildData.toJSON(), null, 2))
      const attachment = new Attachment(data, guildId + '.json')
      await message.channel.send(attachment)
    } else {
      await message.channel.send(translate('commands.backup.noPermission'))
    }
  } catch (err) {
    log.command.warning('rssbackup', err)
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.command.warning('rssbackup 1', message.guild, err))
  }
}
