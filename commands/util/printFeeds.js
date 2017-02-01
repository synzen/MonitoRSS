const loadCommand = (command) => require(`../${command}`)
const config = require('../../config.json')
const commandList = require('../../util/commandList.json')
const channelTracker = require('../../util/channelTracker.js')

module.exports = function (bot, message, isCallingCmd, command, callback) {
  if (commandList[command] != null) var commandFile = commandList[command].file
  var rssList = []
  try {rssList = require(`../../sources/${message.guild.id}.json`).sources} catch(e) {}

  var embed = {embed: {
    color: config.menuColor,
    description: `**Server Limit:** ${rssList.length}/${config.maxFeeds}\n`,
    author: {},
    fields: [],
    footer: {}
  }}

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
    if (isNaN(parseInt(channel,10)) && bot.channels.find("name", channel) != null) return `<#${bot.channels.find("name", channel).id}>`;
    else if (bot.channels.get(channel) != null) return `<#${channel}>`;
    else return `Error: ${channel} not found in guild.`;
  }

  var currentRSSList = [];
  for (var rssIndex in rssList){
    if (isCallingCmd && isCurrentChannel(rssList[rssIndex].channel)) currentRSSList.push( [rssList[rssIndex].link, rssIndex, rssList[rssIndex].title] );
    else if (!isCallingCmd) currentRSSList.push( [rssList[rssIndex].link, rssIndex, rssList[rssIndex].title, getChannel(rssList[rssIndex].channel)] )
  }


  if (currentRSSList.length <= 0) {
    if (isCallingCmd) return message.channel.sendMessage("No feeds assigned to this channel.");
    else return message.channel.sendMessage("There are no existing feeds.");
  }

  let returnMsg = "```Markdown\n# Feeds assigned to this channel: ``````Markdown\n"
  for (var x in currentRSSList) {
    let count = parseInt(x,10) + 1;
    returnMsg += `[${count}]: ${currentRSSList[x][0]}\n`
    embed.embed.fields.push({
      name: `${count})  ${currentRSSList[x][2]}`,
      value: ""
    })
    if (isCallingCmd) embed.embed.fields[embed.embed.fields.length - 1].value = `Link: ${currentRSSList[x][0]}`;
    else embed.embed.fields[embed.embed.fields.length - 1].value = `Channel: ${currentRSSList[x][3]}\nLink: ${currentRSSList[x][0]}`;
  }

  if (isCallingCmd) {
    embed.embed.author.name = "Feed Selection Menu";
    embed.embed.description += `**Channel:** #${message.channel.name}\n**Action**: ${commandList[command].action}\n\nChoose a feed to from this channel by typing the number to execute your requested action on. Type **exit** to cancel.\n_____`;
    var error = false;
    message.channel.sendEmbed(embed.embed).catch(err => {error = true; console.log(`Message Error: (${message.guild.id}, ${message.guild.name}) => Could not send message of embed feed selection list. Reason: ${err.response.body.message}`);});

  }
  else {
    embed.embed.author.name = "Current Active Feeds"
    embed.embed.description += `_____`;
    return message.channel.sendEmbed(embed.embed).catch(err => console.log(`Message Error: (${message.guild.id}, ${message.guild.name}) => Could not send message of embed feed list. Reason: ${err.response.body.message}`));
  }

  if (error) return;

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
