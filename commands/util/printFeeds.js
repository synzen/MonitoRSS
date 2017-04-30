const Discord = require('discord.js')
const config = require('../../config.json')
const commandList = require('../../util/commandList.json')
const channelTracker = require('../../util/channelTracker.js')
const currentGuilds = require('../../util/guildStorage.js').currentGuilds

module.exports = function(bot, message, command, callback) {
  const guildRss = currentGuilds.get(message.guild.id)
  if (!guildRss || !guildRss.sources || guildRss.sources.size() === 0) return message.channel.sendMessage('There are no existing feeds.').catch(err => console.log(`Promise Warning: printFeeds 2: ${err}`));

  function isCurrentChannel(channel) {
    if (isNaN(parseInt(channel,10))) return message.channel.name == channel;
    return message.channel.id == channel;
  }

  const rssList = guildRss.sources
  let maxFeedsAllowed = (guildRss.limitOverride != null) ? guildRss.limitOverride : (!config.feedSettings.maxFeeds || isNaN(parseInt(config.feedSettings.maxFeeds))) ? 0 : config.feedSettings.maxFeeds
  if (maxFeedsAllowed === 0) maxFeedsAllowed = 'Unlimited'
  let embedMsg = new Discord.RichEmbed()
    .setColor(config.botSettings.menuColor)
    .setAuthor('Feed Selection Menu')
    .setDescription(`**Server Limit:** ${rssList.size()}/${maxFeedsAllowed}\n**Channel:** #${message.channel.name}\n**Action**: ${commandList[command].action}\n\nChoose a feed to from this channel by typing the number to execute your requested action on. Type **exit** to cancel.\u200b\n\u200b\n`);
  const currentRSSList = []

  for (var rssName in rssList) { // Generate the info for each feed as an array, and push into another array
    if (isCurrentChannel(rssList[rssName].channel)) currentRSSList.push( [rssList[rssName].link, rssName, rssList[rssName].title] );
  }

  if (currentRSSList.length === 0) return message.channel.sendMessage('No feeds assigned to this channel.').catch(err => console.log(`Promise Warning: printFeeds 1: ${err}`));

  const pages = []
  for (var x in currentRSSList) {
    const count = parseInt(x, 10) + 1;
    const link = currentRSSList[x][0];
    const title =  currentRSSList[x][2];
    const channelName = currentRSSList[x][3];

    // 10 feeds per embed (AKA page)
    if ((count - 1) !== 0 && (count - 1) / 10 % 1 === 0) {
      pages.push(embedMsg);
      embedMsg = new Discord.RichEmbed().setColor(config.botSettings.menuColor)
    }

    embedMsg.addField(`${count})  ${title}`, `Link: ${link}`);
  }

  // Push the leftover results into the last embed
  pages.push(embedMsg);

    // Embed sometimes fails to send for no reason - something yet to be fixed. Thus a temporary fix is this promise
    let successCount = 1
    for (var page in pages) {
      message.channel.sendEmbed(pages[page])
      .then(m => {
        if (successCount++ === pages.length) selectFeed();
      })
      .catch(err => message.channel.sendMessage(`An error has occured an could not send the feed selection list.`).catch(err => console.log(`Commands Warning: (${message.guild.id}, ${message.guild.name}) => Could not send message of embed feed list (${parseInt(page, 10) + 1}/${pages.length}) (${err}).`)));
    }

  // Only start message collector if all pages were sent
  function selectFeed() {
    const filter = m => m.author.id == message.author.id
    const collector = message.channel.createCollector(filter,{time:60000})
    channelTracker.addCollector(message.channel.id)

    collector.on('message', function(m) {
      let chosenOption = m.content
      if (chosenOption.toLowerCase() === 'exit') return collector.stop('Feed selection menu closed.');

      // Return an array of selected indices for feed removal
      if (commandList[command].action === 'Feed Removal') {
        let rawArray = chosenOption.split(',');

        for (var p = rawArray.length - 1; p >= 0; p--) { // Sanitize the input
          rawArray[p] = rawArray[p].trim();
          if (!rawArray[p]) rawArray.splice(p, 1);
        }

        let chosenOptionList = rawArray.filter(function(elem, index, self) { // Remove duplicates
          return index == self.indexOf(elem);
        })

        let validChosens = [];
        let invalidChosens = [];

        for (var z in chosenOptionList) {
          let index = parseInt(chosenOptionList[z], 10) - 1;
          if (isNaN(index) || index + 1 > currentRSSList.length || index + 1 < 1) invalidChosens.push(chosenOptionList[z]);
          else validChosens.push(index);
        }

        if (invalidChosens.length > 0) return message.channel.sendMessage(`The numbers \`${invalidChosens}\` are invalid. Try again.`).catch(err => console.log(`Promise Warning: printFeeds 4: ${err}`));
        else {
          collector.stop();
          for (var q in validChosens) {
            validChosens[q] = currentRSSList[validChosens[q]][1];
          }
          return callback(validChosens);
        }
      }

      // Return a single index for non feed removal actions
      const index = parseInt(chosenOption, 10) - 1

      if (isNaN(index) || index + 1 > currentRSSList.length || index + 1 < 1) return message.channel.sendMessage('That is not a valid number.').catch(err => console.log(`Promise Warning: printFeeds 4: ${err}`));

      collector.stop()
      callback(currentRSSList[index][1])

    })
    collector.on('end', function(collected, reason) {
      channelTracker.removeCollector(message.channel.id)
      if (reason === 'time') return message.channel.sendMessage(`I have closed the menu due to inactivity.`);
      else if (reason !== 'user') return message.channel.sendMessage(reason);
    })
  }
}
