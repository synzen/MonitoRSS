const rssConfig = require('../config.json')
const rssList = rssConfig.sources
const updateConfig = require('../util/updateJSON.js')

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
  if (currentRSSList.length <= 0) return message.channel.sendMessage("No feeds assigned to this channel.");
  else {
    let returnMsg = "```Markdown\n# Feeds assigned to this channel: ``````Markdown\n"
    for (var x in currentRSSList) {
      let count = parseInt(x,10) + 1;
      returnMsg += `[${count}]: ${currentRSSList[x][0]}\n`
    }
    message.channel.sendMessage(returnMsg + "``````# Choose a feed from this channel by typing the number to customize its message or type exit to cancel.```");

    const filter = m => m.author.id == message.author.id;
    const collector = message.channel.createCollector(filter,{time:60000});
    collector.on('message', m => {

      if (m == "exit") return collector.stop("RSS customization menu closed.");

      let index = parseInt(m,10) - 1;

      if (isNaN(index) || m > currentRSSList.length) return message.channel.sendMessage("That is not a valid number.");
      else {
        collector.stop();
        message.channel.sendMessage("Type your new customized message now, or exit to cancel. 180 second timeframe.");

        const customCollect = message.channel.createCollector(filter,{time:180000});
        customCollect.on('message', m => {
          if (m == "exit") return collector.stop("RSS customization menu closed.");
          customCollect.stop()
          let rssIndex = currentRSSList[index][1]

          message.channel.sendMessage(`Message recorded: \`\`\`${m}\`\`\` for feed ${rssList[rssIndex].name}`)

          rssList[rssIndex].message = m
          updateConfig('./config.json', rssConfig);

        });


        customCollect.on('end', (collected, reason) => {
          if (reason == "time")
            return message.channel.sendMessage(`I have closed the menu due to inactivity.`);

          else return message.channel.sendMessage(reason).then( m => m.delete(5000) );
        });


      }

    })

    collector.on('end', (collected, reason) => {
      if (reason == "time")
        return message.channel.sendMessage(`I have closed the menu due to inactivity.`);

      else return message.channel.sendMessage(reason).then( m => m.delete(5000) );
    })

}
