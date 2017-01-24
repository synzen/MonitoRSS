const loadCommand = (command) => require(`../${command}.js`)
const rssConfig = require('../../config.json')
const fs = require('fs')

module.exports = function (bot, message, isCallingCmd, command) {
  var rssList = []

  if (fs.existsSync(`./sources/${message.guild.id}.json`))
    rssList = require(`../../sources/${message.guild.id}.json`).sources

    var embed = {embed: {
      color: 0x778899,
      description: `**Channel:** #${message.channel.name}\n**Global Limit:** ${rssList.length}/${rssConfig.maxFeeds}\n`,
      author: {name: `Active Feeds for Current Channel`},
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

  var currentRSSList = [];
  for (var rssIndex in rssList){
    if (isCurrentChannel(rssList[rssIndex].channel)) currentRSSList.push( [rssList[rssIndex].link, rssIndex, rssList[rssIndex].title] );
  }


  if (currentRSSList.length <= 0) {
    return message.channel.sendMessage("No feeds assigned to this channel.");
  }

  else {
    let returnMsg = "```Markdown\n# Feeds assigned to this channel: ``````Markdown\n"
    for (var x in currentRSSList) {
      let count = parseInt(x,10) + 1;
      returnMsg += `[${count}]: ${currentRSSList[x][0]}\n`
      embed.embed.fields.push({
        name: `${count})  ${currentRSSList[x][2]}`,
        value: "Link: " + currentRSSList[x][0]
      })
    }

    if (isCallingCmd) {
      embed.embed.author.name = "Feed Selection Menu";
      embed.embed.description += `\nChoose a feed to from this channel by typing the number to execute your requested action on. Type **exit** to cancel.\n_____`;
      message.channel.sendMessage("",embed);
    }
    else {
      embed.embed.description += `_____`;
      return message.channel.sendMessage("",embed);
    }

    const filter = m => m.author.id == message.author.id;
    const collector = message.channel.createCollector(filter,{time:60000});


    collector.on('message', function (m) {
      if (m.content.toLowerCase() == "exit") return collector.stop("RSS Feed selection menu closed.");
      let index = parseInt(m,10) - 1;

      if (isNaN(index) || m > currentRSSList.length) return message.channel.sendMessage("That is not a valid number.");
      else {
        collector.stop();
        let rssIndex = currentRSSList[index][1];
        loadCommand(command)(message, rssIndex);
      }
    })
    collector.on('end', (collected, reason) => {
      if (reason == "time") return message.channel.sendMessage(`I have closed the menu due to inactivity.`);
      else if (reason !== "user") return message.channel.sendMessage(reason);
    })
  }
}
