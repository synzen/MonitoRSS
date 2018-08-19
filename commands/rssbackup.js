const Attachment = require('discord.js').Attachment
const currentGuilds = require('../util/storage.js').currentGuilds
const log = require('../util/logger.js')

module.exports = async (bot, message, automatic) => { // automatic indicates invokation by the bot
  const guildRss = currentGuilds.get(message.guild.id)
  try {
    if (!guildRss && !automatic) await message.channel.send('This server does not have a profile.')
    if (!guildRss) return
    const backup = JSON.parse(JSON.stringify(guildRss, null, 2))
    delete backup._id
    delete backup.__v
    if (message.guild.me.permissionsIn(message.channel).has('ATTACH_FILES')) await message.channel.send(new Attachment(Buffer.from(JSON.stringify(backup, null, 2)), message.guild.id + '.json'))
    else await message.channel.send('Unable to send backup due to missing `Attach Files` permission.')
  } catch (err) {
    log.command.warning('rssbackup', err)
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.command.warning('rssbackup 1', message.guild, err))
  }
}
