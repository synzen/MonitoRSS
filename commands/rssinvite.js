const log = require('../util/logger.js')
const generateText = id => `Invite with Role - <https://discordapp.com/oauth2/authorize?client_id=${id}&scope=bot&permissions=19456>

Invite without Role - <https://discordapp.com/oauth2/authorize?client_id=${id}&scope=bot>`

module.exports = async (bot, message, automatic) => { // automatic indicates invokation by the bot
  try {
    await message.channel.send(generateText(message.client.user.id))
  } catch (err) {
    log.command.warning('rssinvite', err)
    if (err.code !== 50013) message.channel.send(err.message).catch(err => log.command.warning('rssinvite 1', message.guild, err))
  }
}
