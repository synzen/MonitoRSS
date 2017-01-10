const loadCommand = (command) => require(`../${command}.js`)
const rssConfig = require('../../config.json')
const rssList = rssConfig.sources

module.exports = function (message, isCallingCmd, command, callback) {

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
    if (isCurrentChannel(rssList[rssIndex].channel)) currentRSSList.push( [rssList[rssIndex].link, rssIndex] );
  }
  if (currentRSSList.length <= 0) {
    callback();
    return message.channel.sendMessage("No feeds assigned to this channel.");
  }
  else {
    let returnMsg = "```Markdown\n# Feeds assigned to this channel: ``````Markdown\n"
    for (var x in currentRSSList) {
      let count = parseInt(x,10) + 1;
      returnMsg += `[${count}]: ${currentRSSList[x][0]}\n`
    }

    if (isCallingCmd) message.channel.sendMessage(returnMsg + "``````# Choose a feed to from this channel by typing the number to execute your requested action on, or type exit to cancel.```");
    else return message.channel.sendMessage(returnMsg + "```");

    const filter = m => m.author.id == message.author.id;
    const collector = message.channel.createCollector(filter,{time:60000});


    collector.on('message', function (m) {
      if (m.content.toLowerCase() == "exit") {callback(); return collector.stop("RSS Feed selection menu closed.");}
      let index = parseInt(m,10) - 1;

      if (isNaN(index) || m > currentRSSList.length) return message.channel.sendMessage("That is not a valid number.");
      else {
        collector.stop();
        let rssIndex = currentRSSList[index][1];
        loadCommand(command)(message, rssIndex, function () {
          callback()
        });
      }
    })
    collector.on('end', (collected, reason) => {
      if (reason == "time") return message.channel.sendMessage(`I have closed the menu due to inactivity.`);

      else if (reason !== "user") return message.channel.sendMessage(reason);
    })
  }
}
