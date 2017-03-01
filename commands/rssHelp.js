const config = require('../config.json')
const commands = require('../util/commandList.json')

module.exports = function (bot, message, command) {

  var msg = 'Available commands are: \n\n'
  for (let cmd in commands){
    msg += `\`${config.botSettings.prefix}${cmd}\`\n${commands[cmd].description}\n\n`
  }
  message.channel.sendMessage(msg + 'Note that this is an **experimental bot**. Should you need it, some support can be found at a server I made at https://discord.gg/WPWRyxK').catch(err => `Promise Warning: rssHelp 1: ${err}`);

}
