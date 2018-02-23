const config = require('../config.json')
const commands = require('../util/commandList.json')
const log = require('../util/logger.js')

module.exports = (bot, message, command) => {
  let msg = 'Available commands are: \n\n'
  for (var cmd in commands) {
    if (commands[cmd].description) msg += `\`${config.botSettings.prefix}${cmd}\` - ${commands[cmd].description}\n`
  }
  message.channel.send(msg + '\nSupport can be found at https://discord.gg/WPWRyxK')
  .catch(err => log.command.warning(`Could not send help menu:`, message.guild, err))
}
