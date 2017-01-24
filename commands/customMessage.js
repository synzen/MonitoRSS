const fileOps = require('../util/updateJSON.js')
const rssConfig = require('../config.json')

module.exports = function (message, rssIndex) {
  var guildRss = require(`../sources/${message.guild.id}.json`)
  var rssList = guildRss.sources

  let currentMsg = "```Markdown\n"
  if (rssList[rssIndex].message == "" || rssList[rssIndex].message == null) currentMsg += "None has been set. Currently using default message below:\n\n``````\n" + rssConfig.defaultMessage;
  else currentMsg += rssList[rssIndex].message

  message.channel.sendMessage(`The current message for ${rssList[rssIndex].link} is: \n${currentMsg + "```"}\nType your new customized message now, type \`reset\` to use the default message, or type \`exit\` to cancel. \n\nRemember that you can use the tags \`{title}\`, \`{description}\`, \`{link}\`, and etc. Regular formatting such as **bold** and etc. is also available. To find other tags, type \`exit\` then \`${rssConfig.prefix}rsstest\`.\n\n`);

  const filter = m => m.author.id == message.author.id;
  const customCollect = message.channel.createCollector(filter,{time:240000});
  customCollect.on('message', function (m) {
    if (m.content.toLowerCase() == "exit") return customCollect.stop("RSS Feed Message customization menu closed.");
    else if (m.content.toLowerCase() == "reset") {
      message.channel.startTyping();
      customCollect.stop();
      delete rssList[rssIndex].message;
      fileOps.updateFile(`./sources/${message.guild.id}.json`, guildRss, `../sources/${message.guild.id}.json`);
      message.channel.stopTyping();
      console.log(`RSS Customization: (${message.guild.id}, ${message.guild.name}) => Message reset for ${rssList[rssIndex].link}.`);
      return message.channel.sendMessage(`Message reset and using default message:\n \`\`\`Markdown\n${rssConfig.defaultMessage}\`\`\` \nfor feed ${rssList[rssIndex].link}`)
    }
    else {
      message.channel.startTyping();
      customCollect.stop();
      rssList[rssIndex].message = m.content;
      fileOps.updateFile(`./sources/${message.guild.id}.json`, guildRss, `../sources/${message.guild.id}.json`);
      message.channel.stopTyping();
      console.log(`RSS Customization: (${message.guild.id}, ${message.guild.name}) => New message recorded for ${rssList[rssIndex].link}.`);
      return message.channel.sendMessage(`Message recorded:\n \`\`\`Markdown\n${m.content}\`\`\` \nfor feed ${rssList[rssIndex].link}You may use \`${rssConfig.prefix}rsstest\` to see your new message format.`);
    }
  });

  customCollect.on('end', (collected, reason) => {
    if (reason == "time") return message.channel.sendMessage(`I have closed the menu due to inactivity.`);
    else if (reason !== "user") return message.channel.sendMessage(reason);
  });

 }
