const config = require('../config.json')

module.exports = function (message, commands) {

  var msg = "Available commands are: \n\n"
  for (let cmd in commands){
    msg += `\`${config.botSettings.prefix}${cmd}\`\n${commands[cmd].description}\n\n`
  }
  message.channel.sendMessage(msg + "Note that this is an **experimental bot**. Should you need it, some support can be found at a server I made at https://discord.gg/WPWRyxK");

}
