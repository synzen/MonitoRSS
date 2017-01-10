const rssConfig = require('../config.json')
const rssList = rssConfig.sources
const updateConfig = require('../util/updateJSON.js')

module.exports = function (message, rssIndex, callback) {
  let currentMsg = "```Markdown\n"
  if (rssList[rssIndex].message == "" || rssList[rssIndex].message == null) currentMsg += "None has been set. Current using default message below:\n\n``````\n" + rssConfig.defaultMessage;
  else currentMsg += rssList[rssIndex].message

  message.channel.sendMessage(`The current message for ${rssList[rssIndex].link} is: \n${currentMsg + "```"}\nType your new customized message now, type \`reset\` to use the default message, or type \`exit\` to cancel. \n\nRemember that you can use the tags \`{title}\`, \`{description}\`, \`{link}\`, and etc. Regular formatting such as **bold** and etc. is also available. To find other tags, type \`exit\` then \`${rssConfig.prefix}rsstest\`.\n\n`);

  const filter = m => m.author.id == message.author.id;
  const customCollect = message.channel.createCollector(filter,{time:240000});
  customCollect.on('message', function (m) {
    if (m.content.toLowerCase() == "exit") {callback(); return customCollect.stop("RSS Feed Message customization menu closed.");}
    else if (m.content.toLowerCase() == "reset") {
      message.channel.startTyping();
      customCollect.stop();
      rssList[rssIndex].message = "";
      updateConfig('./config.json', rssConfig);
      callback();
      message.channel.stopTyping();
      return message.channel.sendMessage(`Message reset and using default message:\n \`\`\`Markdown\n${rssConfig.defaultMessage}\`\`\` \nfor feed ${rssList[rssIndex].link}`)
    }
    else {
      message.channel.startTyping();
      customCollect.stop()
      rssList[rssIndex].message = m.content
      updateConfig('./config.json', rssConfig);
      callback();
      message.channel.stopTyping();
      return message.channel.sendMessage(`Message recorded:\n \`\`\`Markdown\n${m.content}\`\`\` \nfor feed ${rssList[rssIndex].link}You may use \`${rssConfig.prefix}rsstest\` to see your new message format.`)
    }
  });

  customCollect.on('end', (collected, reason) => {
    if (reason == "time") return message.channel.sendMessage(`I have closed the menu due to inactivity.`);
    else if (reason !== "user") return message.channel.sendMessage(reason);
  });

 }
