const log = require('../util/logger.js')
const dbOpsGuilds = require('../util/db/guilds.js')
const Translator = require('../structs/Translator.js')

module.exports = async (bot, message, automatic) => { // automatic indicates invokation by the bot
  try {
    const guildRss = await dbOpsGuilds.get(message.guild.id)
    await message.channel.send(Translator.translate('commands.rssinvite.text', guildRss ? guildRss.locale : undefined, { id: bot.user.id }))
  } catch (err) {
    log.command.warning('rssinvite', err)
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.command.warning('rssinvite 1', message.guild, err))
  }
}
