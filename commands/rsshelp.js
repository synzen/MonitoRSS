const config = require('../config.json')
const commands = require('../util/commandList.json')

module.exports = function (bot, message, command) {
  let msg = 'Available commands are: \n\n'
  for (var cmd in commands) {
    if (commands[cmd].description) msg += `\`${config.botSettings.prefix}${cmd}\`\n${commands[cmd].description}\n\n`
  }
  message.channel.send(msg + 'Support can be found at https://discord.gg/WPWRyxK')
  .catch(err => console.log(`Commands Warning: (${message.guild.id}, ${message.guild.name}) => Could not send help menu. (${err})`))
}
