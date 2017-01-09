const rssConfig = require('../config.json')
const rssList = rssConfig.sources
const updateConfig = require('../util/updateJSON.js')

module.exports = function (message, rssIndex, callback) {
  let currentMsg = "```Markdown\n"
  if (rssList[rssIndex].message == "" || rssList[rssIndex].message == null) currentMsg += "None has been set. Current using default message below:\n\n``````\n" + rssConfig.defaultMessage;
  else currentMsg += rssList[rssIndex].message

  message.channel.sendMessage(`The current message for ${rssList[rssIndex].link} is: \n${currentMsg + "```"}\nType your new customized message now, type \`reset\` to use the default message, or type \`exit\` to cancel. \n\nRemember that you can use the tags {title}, {description}, {link}, and etc. Use \`${rssConfig.prefix}rsstest\` first to find valid properties for the feed.\n\n 4 minute timeframe.`);

  const filter = m => m.author.id == message.author.id;
  const customCollect = message.channel.createCollector(filter,{time:240000});
  customCollect.on('message', function (m) {
    if (m.content.toLowerCase() == "exit") {callback(); return customCollect.stop("RSS Feed Message customization menu closed.");}
    if (m.content.toLowerCase() == "reset") {
      customCollect.stop();
      rssList[rssIndex].message = "";
      updateConfig('./config.json', rssConfig);
      callback();
      message.channel.sendMessage(`Message reset and using default message:\n \`\`\`Markdown\n${rssConfig.defaultMessage}\`\`\` \nfor feed ${rssList[rssIndex].link}`)
    }
    customCollect.stop()
    message.channel.sendMessage(`Message recorded:\n \`\`\`Markdown\n${m.content}\`\`\` \nfor feed ${rssList[rssIndex].link}`)
    rssList[rssIndex].message = m.content
    updateConfig('./config.json', rssConfig);
    return callback();
  });

  customCollect.on('end', (collected, reason) => {
    if (reason == "time") return message.channel.sendMessage(`I have closed the menu due to inactivity.`);
    else if (reason !== "user") return message.channel.sendMessage(reason).then( m => m.delete(5000) );
  });

 }
