const rssConfig = require('../config.json')

module.exports = function (commands, message) {

  var msg = "Available commands are: \n\n"
  for (let cmd in commands){
    msg += `\`${rssConfig.prefix}${cmd}\`\n${commands[cmd].description}\n\n`
  }
  message.channel.sendMessage(msg);

}
