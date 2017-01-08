const rssConfig = require('../config.json')
const rssList = rssConfig.sources
const updateConfig = require('../util/updateJSON.js')
const sqlCmds = require('../rss/sql/commands.js')

module.exports = function (bot, message) {

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
    if (isCurrentChannel(rssList[rssIndex].channel))
      currentRSSList.push( [rssList[rssIndex].link, rssIndex] );
  }
  if (currentRSSList.length <= 0) return message.channel.sendMessage("No RSS assigned to this channel.");
  else {
    let returnMsg = "```Markdown\n# RSS assigned to this channel: ``````Markdown\n"
    for (var x in currentRSSList) {
      let count = parseInt(x,10) + 1;
      returnMsg += `[${count}]: ${currentRSSList[x][0]}\n`
    }
    message.channel.sendMessage(returnMsg + "``````# Choose an RSS to remove from this channel by typing the number.```");

    const filter = m => m.author.id == message.author.id;
    const collector = message.channel.createCollector(filter,{time:60000});
    collector.on('message', m => {
      if (m == "exit") return collector.stop("RSS remove menu closed.");

      let index = parseInt(m,10) - 1;

      if (isNaN(index)) return;
      else if (m > currentRSSList.length) return;
      else {
        collector.stop();
        let rssIndex = currentRSSList[index][1];
        message.channel.sendMessage("Removed " + currentRSSList[index][0]);
        sqlCmds.dropTable(rssConfig.databaseName, rssList[rssIndex].name);
        rssList.splice(rssIndex,1);
        updateConfig('./config.json', rssConfig);

        var enabledFeeds = 0;
        for (var x in rssList)
          if (rssList[x].enabled == 1) enabledFeeds++;

        if (enabledFeeds == 0 || rssList.length == 0) console.log("RSS Info: No more active feeds enabled.")

      }

    })

    collector.on('end', (collected, reason) => {
      if (reason == "time")
        return message.channel.sendMessage(`I have closed the menu due your inactivity, ${author}.`);

      else return message.channel.sendMessage(reason).then( m => m.delete(5000) );
    })
  }

}
