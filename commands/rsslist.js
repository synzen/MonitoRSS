const Discord = require('discord.js')
const config = require('../config.json')
const storage = require('../util/storage.js')
const currentGuilds = storage.currentGuilds
const overriddenGuilds = storage.overriddenGuilds
const pageControls = require('../util/pageControls.js')   // reserved for when discord.js fixes their library

module.exports = function(bot, message, command) {
  const guildRss = currentGuilds.get(message.guild.id)
  if (!guildRss || !guildRss.sources || guildRss.sources.size() === 0) return message.channel.send('There are no existing feeds.').catch(err => console.log(`Promise Warning: printFeeds 2: ${err}`));

  const rssList = guildRss.sources

  // Function to get channel name, resolving for whether it the identifier is an ID or a string
  function getChannel(channel) {
    if (isNaN(parseInt(channel, 10)) && bot.channels.find('name', channel)) return `${bot.channels.find('name', channel).name}`;
    else if (bot.channels.get(channel)) return bot.channels.get(channel).name;
    else return undefined;
  }

  let maxFeedsAllowed = overriddenGuilds[message.guild.id] ? overriddenGuilds[message.guild.id] : (!config.feedSettings.maxFeeds || isNaN(parseInt(config.feedSettings.maxFeeds))) ? 0 : config.feedSettings.maxFeeds
  if (maxFeedsAllowed === 0) maxFeedsAllowed = 'Unlimited';

  let embedMsg = new Discord.RichEmbed().setColor(config.botSettings.menuColor)
    .setAuthor('Current Active Feeds')
    .setDescription(`**Server Limit:** ${rssList.size()}/${maxFeedsAllowed}\u200b\n\u200b\n`);

  // Generate the info for each feed as an array, and push into another array
  const currentRSSList = []
  for (var rssName in rssList){
    currentRSSList.push( [rssList[rssName].link, rssList[rssName].title, getChannel(rssList[rssName].channel)] )
  }

  const pages = []
  for (var x in currentRSSList) {
    const count = parseInt(x, 10) + 1;
    const link = currentRSSList[x][0];
    const title =  currentRSSList[x][1];
    const channelName = currentRSSList[x][2];

    // 10 feeds per embed
    if ((count - 1) !== 0 && (count - 1) / 10 % 1 === 0) {
      pages.push(embedMsg);
      embedMsg = new Discord.RichEmbed().setColor(config.botSettings.menuColor).setDescription(`Page ${pages.length + 1}\n\u200b`);
    }

    embedMsg.addField(`${count})  ${title}`, `Channel: #${channelName}\nLink: ${link}`);
  }

  // Push the leftover results into the last embed
  pages.push(embedMsg);

  message.channel.send({embed: pages[0]})
  .then(m => {
    if (pages.length === 1) return;
    m.react('◀')
    .then(rct => m.react('▶').catch(err => console.log(`yep2`, err)))
    .catch(err => console.log(`yep`, err))
    pageControls.add(m.id, pages)
  })
  .catch(err => console.log(`Message Error: (${message.guild.id}, ${message.guild.name}) => Could not send message of embed feed list. Reason: ${err}`));

}
