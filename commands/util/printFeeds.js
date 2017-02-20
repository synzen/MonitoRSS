const Discord = require('discord.js')
const loadCommand = (command) => require(`../${command}`)
const config = require('../../config.json')
const commandList = require('../../util/commandList.json')
const channelTracker = require('../../util/channelTracker.js')

module.exports = function (bot, message, isCallingCmd, command, callback) {
  if (commandList[command] != null) var commandFile = commandList[command].file
  var rssList = []
  var maxFeedsAllowed = (!config.feedSettings.maxFeeds || isNaN(parseInt(config.feedSettings.maxFeeds))) ? 'Unlimited' : (config.feedSettings.maxFeeds == 0) ? 'Unlimited' : config.feedSettings.maxFeeds

  try {rssList = require(`../../sources/${message.guild.id}.json`).sources} catch(e) {}

  var embedMsg = new Discord.RichEmbed().setColor(config.botSettings.menuColor)

  function isCurrentChannel(channel) {
    if (isNaN(parseInt(channel,10))) {
      if (message.channel.name == channel) return true;
      else return false;
    }
    else {
      if (message.channel.id == channel) return true;
      else return false;
    }
  }

  function getChannel(channel) {
    if (isNaN(parseInt(channel,10)) && bot.channels.find("name", channel) != null) return `${bot.channels.find("name", channel).name}`;
    else if (bot.channels.get(channel) != null) return bot.channels.get(channel).name;
    else return undefined;
  }

  var currentRSSList = [];
  for (var rssIndex in rssList){
    if (isCallingCmd && isCurrentChannel(rssList[rssIndex].channel)) currentRSSList.push( [rssList[rssIndex].link, rssIndex, rssList[rssIndex].title] );
    else if (!isCallingCmd) currentRSSList.push( [rssList[rssIndex].link, rssIndex, rssList[rssIndex].title, getChannel(rssList[rssIndex].channel)] )
  }


  if (currentRSSList.length == 0) {
    if (isCallingCmd) return message.channel.sendMessage("No feeds assigned to this channel.");
    else return message.channel.sendMessage("There are no existing feeds.");
  }

  for (var x in currentRSSList) {
    let count = parseInt(x,10) + 1;
    let link = currentRSSList[x][0];
    let title =  currentRSSList[x][2];
    let channelName = currentRSSList[x][3];

    if (isCallingCmd) var info = `Link: ${link}`;
    else var info = `Channel: #${channelName}\nLink: ${link}`;

    // if (channelID !== undefined) {
    embedMsg.addField(`${count})  ${title}`, info);
    // }
  }

  if (isCallingCmd) {
    embedMsg.setAuthor('Feed Selection Menu');
    embedMsg.setDescription(`**Server Limit:** ${rssList.length}/${maxFeedsAllowed}\n**Channel:** #${message.channel.name}\n**Action**: ${commandList[command].action}\n\nChoose a feed to from this channel by typing the number to execute your requested action on. Type **exit** to cancel.\n_____`);
    var error = false;
    message.channel.sendEmbed(embedMsg)
    .catch(err => {
      error = true;
      message.channel.sendMessage(`An error has occured an could not send the feed selection list. This is currently an issue that has yet to be resolved - you can try readding the feed/bot, or if it persists please ask me to come into your server and debug.`);
      console.log(`Message Error: (${message.guild.id}, ${message.guild.name}) => Could not send message of embed feed selection list. Reason: ${err.response.body.message}, embed is: `, embedMsg);});
  }
  else {
    embedMsg.setAuthor('Current Active Feeds');
    embedMsg.setDescription(`**Server Limit:** ${rssList.length}/${maxFeedsAllowed}\n_____`);
    return message.channel.sendEmbed(embedMsg).catch(err => console.log(`Message Error: (${message.guild.id}, ${message.guild.name}) => Could not send message of embed feed list. Reason: ${err.response.body.message}`));
  }

  if (error) {console.log("print feeds returning due to error"); return;}

  const filter = m => m.author.id == message.author.id
  const collector = message.channel.createCollector(filter,{time:60000})
  channelTracker.addCollector(message.channel.id)

  collector.on('message', function (m) {
    let chosenOption = m.content;
    if (chosenOption.toLowerCase() == "exit") return collector.stop("RSS Feed selection menu closed.");
    let index = parseInt(chosenOption, 10) - 1;

    if (isNaN(index) || chosenOption > currentRSSList.length || chosenOption < 1) return message.channel.sendMessage("That is not a valid number.");
    else {
      collector.stop();
      let rssIndex = currentRSSList[index][1];
      if (!commandList[command].specialCmd) loadCommand(commandFile)(message, rssIndex);
      else callback(rssIndex);
    }
  })
  collector.on('end', (collected, reason) => {
    channelTracker.removeCollector(message.channel.id)
    if (reason == "time") return message.channel.sendMessage(`I have closed the menu due to inactivity.`);
    else if (reason !== "user") return message.channel.sendMessage(reason);
  })

}
