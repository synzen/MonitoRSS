const Discord = require('discord.js')
const config = require('../../config.json')
const commandList = require('../../util/commandList.json')
const channelTracker = require('../../util/channelTracker.js')
const storage = require('../../util/storage.js')
const currentGuilds = storage.currentGuilds
const overriddenGuilds = storage.overriddenGuilds
const failedFeeds = storage.failedFeeds
const pageControls = require('../../util/pageControls.js')   // reserved for when discord.js fixes their library

module.exports = function(bot, message, command, callback, miscOption) { // miscOption is for rssoptions command
  const guildRss = currentGuilds.get(message.guild.id)
  if (!guildRss || !guildRss.sources || guildRss.sources.size() === 0) return message.channel.send('There are no existing feeds.').catch(err => console.log(`Promise Warning: printFeeds 2: ${err}`));

  const rssList = guildRss.sources
  let maxFeedsAllowed = overriddenGuilds[message.guild.id] != null ? overriddenGuilds[message.guild.id] : (!config.feedSettings.maxFeeds || isNaN(parseInt(config.feedSettings.maxFeeds))) ? 0 : config.feedSettings.maxFeeds
  if (maxFeedsAllowed === 0) maxFeedsAllowed = 'Unlimited'
  let embedMsg = new Discord.RichEmbed()
    .setColor(config.botSettings.menuColor)
    .setAuthor('Feed Selection Menu')
    .setDescription(`**Server Limit:** ${rssList.size()}/${maxFeedsAllowed}\n**Channel:** #${message.channel.name}\n**Action**: ${command === 'rssoptions' ? commandList[command].options[miscOption] : commandList[command].action}\n\nChoose a feed to from this channel by typing the number to execute your requested action on. ${commandList[command].action === 'Feed Removal' ? 'You may select multiple feeds to remove by separation with commas. ' : ''}Type **exit** to cancel.\u200b\n\u200b\n`);

  const failLimit = (config.feedSettings.failLimit && !isNaN(parseInt(config.feedSettings.failLimit, 10))) ? parseInt(config.feedSettings.failLimit, 10) : 0

  const currentRSSList = []

  if (commandList[command].action === 'Refresh Feed') {
    var failedFeedCount = 0;

    function getFeedStatus(link) {
      const failCount = failedFeeds[link]
      if (!failCount || typeof failCount === 'number' && failCount < failLimit) return 'Status: OK\n';
      else {
          failedFeedCount++;
          return 'Status: FAILED\n';
      }
    }
  }

  for (var rssName in rssList) { // Generate the info for each feed as an array, and push into another array
    let o = {link: rssList[rssName].link, rssName: rssName, title: rssList[rssName].title};
    if (commandList[command].action === 'Refresh Feed') o.status = getFeedStatus(rssList[rssName].link);
    if (miscOption === 'titleChecks') o.titleChecks = rssList[rssName].checkTitles == true ? 'Title Checks: Enabled\n' : 'Title Checks: Disabled\n';
    if (message.channel.id === rssList[rssName].channel) currentRSSList.push(o);
  }

  if (currentRSSList.length === 0) return message.channel.send('No feeds assigned to this channel.').catch(err => console.log(`Promise Warning: printFeeds 1: ${err}`));

  const pages = []
  for (var x in currentRSSList) {
    const count = parseInt(x, 10) + 1;
    const link = currentRSSList[x].link;
    const title =  currentRSSList[x].title;
    const status = currentRSSList[x].status;
    const titleChecks = currentRSSList[x].titleChecks;

    // 10 feeds per embed (AKA page)
    if ((count - 1) !== 0 && (count - 1) / 7 % 1 === 0) {
      pages.push(embedMsg);
      embedMsg = new Discord.RichEmbed().setColor(config.botSettings.menuColor).setDescription(`Page ${pages.length + 1}`)
    }

    embedMsg.addField(`${count})  ${title}`, `${titleChecks ? titleChecks : ''}${status ? status: ''}Link: ${link}`);
  }

  // Push the leftover results into the last embed
  pages.push(embedMsg);

  message.channel.send({embed: pages[0]})
  .then(m => {
    selectFeed()
    if (pages.length === 1) return;
    m.react('◀').then(rct => {
      m.react('▶').then(rct2 => {
        pageControls.add(m.id, pages)
      }).catch(err => console.log(`Reaction Error: (${message.guild.id}, ${message.guild.name}) => Could not add emoticon >. Reason: `, err))
    }).catch(err => console.log(`Reaction Error: (${message.guild.id}, ${message.guild.name}) => Could not add emoticon <. Reason: `, err))
  }).catch(err => console.log(`Message Error: (${message.guild.id}, ${message.guild.name}) => Could not send message of embed feed selection list. Reason: `, err));

  // Only start message collector if all pages were sent
  function selectFeed() {
    const filter = m => m.author.id == message.author.id
    const collector = message.channel.createMessageCollector(filter,{time:60000})
    channelTracker.addCollector(message.channel.id)

    collector.on('collect', function(m) {
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

        if (invalidChosens.length > 0) return message.channel.send(`The numbers \`${invalidChosens}\` are invalid. Try again.`).catch(err => console.log(`Promise Warning: printFeeds 4: ${err}`));
        else {
          collector.stop();
          for (var q in validChosens) {
            validChosens[q] = currentRSSList[validChosens[q]].rssName;
          }
          return callback(validChosens);
        }
      }

      // Return a single index for non feed removal actions
      const index = parseInt(chosenOption, 10) - 1

      if (isNaN(index) || index + 1 > currentRSSList.length || index + 1 < 1) return message.channel.send('That is not a valid number.').catch(err => console.log(`Promise Warning: printFeeds 4: ${err}`));

      collector.stop()
      callback(currentRSSList[index].rssName)

    })
    collector.on('end', function(collected, reason) {
      channelTracker.removeCollector(message.channel.id)
      if (reason === 'time') return message.channel.send(`I have closed the menu due to inactivity.`);
      else if (reason !== 'user') return message.channel.send(reason);
    })
  }
}
