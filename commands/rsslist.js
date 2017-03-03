const Discord = require('discord.js')
const config = require('../config.json')

module.exports = function (bot, message, command) {
  var rssList = {}
  try {
    rssList = require(`../sources/${message.guild.id}.json`).sources
  } catch(e) {}
  if (rssList.size() === 0) return message.channel.sendMessage('There are no existing feeds.').catch(err => console.log(`Promise Warning: printFeeds 2: ${err}`));

  function getChannel(channel) {
    if (isNaN(parseInt(channel, 10)) && bot.channels.find('name', channel)) return `${bot.channels.find('name', channel).name}`;
    else if (bot.channels.get(channel)) return bot.channels.get(channel).name;
    else return undefined;
  }

  var embedMsg = new Discord.RichEmbed().setColor(config.botSettings.menuColor)
  var maxFeedsAllowed = (!config.feedSettings.maxFeeds || isNaN(parseInt(config.feedSettings.maxFeeds))) ? 'Unlimited' : (config.feedSettings.maxFeeds == 0) ? 'Unlimited' : config.feedSettings.maxFeeds
  
  var currentRSSList = []
  for (var rssName in rssList){
    currentRSSList.push( [rssList[rssName].link, rssName, rssList[rssName].title, getChannel(rssList[rssName].channel)] )
  }

  for (var x in currentRSSList) {
    let count = parseInt(x,10) + 1;
    let link = currentRSSList[x][0];
    let title =  currentRSSList[x][2];
    let channelName = currentRSSList[x][3];

    embedMsg.addField(`${count})  ${title}`, `Channel: #${channelName}\nLink: ${link}`);
  }

  embedMsg.setAuthor('Current Active Feeds');
  embedMsg.setDescription(`**Server Limit:** ${rssList.size()}/${maxFeedsAllowed}\n_____`);
  return message.channel.sendEmbed(embedMsg).catch(err => console.log(`Message Error: (${message.guild.id}, ${message.guild.name}) => Could not send message of embed feed list. Reason: ${err.response.body.message}`));


}
