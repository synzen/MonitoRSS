const log = require('../util/logger.js')
const GuildProfile = require('../structs/db/GuildProfile.js')
const Translator = require('../structs/Translator.js')

module.exports = async (bot, message, automatic) => { // automatic indicates invokation by the bot
  try {
    const profile = await GuildProfile.get(message.guild.id)
    await message.channel.send(Translator.translate('commands.invite.text', profile ? profile.locale : undefined, {
      id: bot.user.id
    }))
  } catch (err) {
    log.command.warning('rssinvite', err)
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.command.warning('rssinvite 1', message.guild, err))
  }
}
