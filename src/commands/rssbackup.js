const Attachment = require('discord.js').Attachment
const log = require('../util/logger.js')
const dbOpsGuilds = require('../util/db/guilds')
const Translator = require('../structs/Translator.js')

module.exports = async (bot, message, automatic) => { // automatic indicates invokation by the bot
  try {
    const guildRss = await dbOpsGuilds.get(message.guild.id)
    const translate = Translator.createLocaleTranslator(guildRss ? guildRss.locale : undefined)
    if (!guildRss && !automatic) await message.channel.send(translate('commands.rssbackup.noProfile'))
    if (!guildRss) return
    const backup = JSON.parse(JSON.stringify(guildRss, null, 2))
    delete backup._id
    delete backup.__v
    if (message.guild.me.permissionsIn(message.channel).has('ATTACH_FILES')) await message.channel.send(new Attachment(Buffer.from(JSON.stringify(backup, null, 2)), message.guild.id + '.json'))
    else await message.channel.send(translate('commands.rssbackup.noPermission'))
  } catch (err) {
    log.command.warning('rssbackup', err)
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.command.warning('rssbackup 1', message.guild, err))
  }
}
