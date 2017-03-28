const fileOps = require('../util/fileOps.js')
const getIndex = require('./util/printFeeds.js')
const config = require('../config.json')
const channelTracker = require('../util/channelTracker.js')
const currentGuilds = require('../util/fetchInterval.js').currentGuilds

module.exports = function (bot, message, command) {

  getIndex(bot, message, command, function(rssName) {
    const guildRss = currentGuilds.get(message.guild.id)
    const rssList = guildRss.sources

    let currentMsg = '```Markdown\n'
    if (!rssList[rssName].message) currentMsg += 'None has been set. Currently using default message below:\n\n``````\n' + config.feedSettings.defaultMessage;
    else currentMsg += rssList[rssName].message;

    message.channel.sendMessage(`The current message for ${rssList[rssName].link} is: \n${currentMsg + '```'}\nType your new customized message now, type \`reset\` to use the default message, or type \`exit\` to cancel. \n\nRemember that you can use the tags \`{title}\`, \`{description}\`, \`{link}\`, and etc. Regular formatting such as **bold** and etc. is also available. To find other tags, type \`exit\` then \`${config.botSettings.prefix}rsstest\`.\n\n`)
    .then(msgPrompt => {
      const filter = m => m.author.id == message.author.id
      const customCollect = message.channel.createCollector(filter,{time:240000})
      channelTracker.addCollector(message.channel.id)

      customCollect.on('message', function(m) {
        if (m.content.toLowerCase() === 'exit') return customCollect.stop('RSS Feed Message customization menu closed.');
        // Reset custom message
        else if (m.content.toLowerCase() === 'reset') message.channel.sendMessage(`Resetting message...`)
        .then(resetMsg => {
          customCollect.stop();
          delete rssList[rssName].message;
          fileOps.updateFile(message.guild.id, guildRss);
          console.log(`RSS Customization: (${message.guild.id}, ${message.guild.name}) => Message reset for ${rssList[rssName].link}.`);
          return resetMsg.edit(`Message reset and using default message:\n \`\`\`Markdown\n${config.feedSettings.defaultMessage}\`\`\` \nfor feed ${rssList[rssName].link}`).catch(err => console.log(`Promise Warning: rssMessage 2a: ${err}`));
        })
        .catch(err => console.log(`Promise Warning: rssMessage 2: ${err}`));
        // Set new message
        else message.channel.sendMessage(`Updating message...`)
        .then(editing => {
          customCollect.stop();
          rssList[rssName].message = m.content;
          fileOps.updateFile(message.guild.id, guildRss);
          console.log(`RSS Customization: (${message.guild.id}, ${message.guild.name}) => New message recorded for ${rssList[rssName].link}.`);
          editing.edit(`Message recorded:\n \`\`\`Markdown\n${m.content}\`\`\` \nfor feed ${rssList[rssName].link}You may use \`${config.botSettings.prefix}rsstest\` to see your new message format.`).catch(err => console.log(`Promise Warning: rssMessage 3a: ${err}`));
        })
        .catch(err => console.log(`Promise Warning: rssMessage 3: ${err}`));
      });

      customCollect.on('end', (collected, reason) => {
        channelTracker.removeCollector(message.channel.id)
        if (reason == 'time') return message.channel.sendMessage(`I have closed the menu due to inactivity.`).catch(err => {});
        else if (reason !== 'user') return message.channel.sendMessage(reason);
      });
    }).catch(err => console.log(`Commands Warning: (${message.guild.id}, ${message.guild.name}) => Could not send custom message prompt (${err}).`));
  })

 }
