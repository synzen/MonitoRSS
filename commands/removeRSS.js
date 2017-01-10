const rssConfig = require('../config.json')
const rssList = rssConfig.sources
const updateConfig = require('../util/updateJSON.js')
const sqlCmds = require('../rss/sql/commands.js')

module.exports = function (message, rssIndex, callback) {
  message.channel.startTyping();
  let link = rssList[rssIndex].link
  sqlCmds.dropTable(rssConfig.databaseName, rssList[rssIndex].name);
  rssList.splice(rssIndex,1);
  updateConfig('./config.json', rssConfig);

  var enabledFeeds = 0;

  for (var x in rssList)
    if (rssList[x].enabled == 1) enabledFeeds++;

  if (enabledFeeds == 0 || rssList.length == 0) console.log("RSS Info: No more active feeds enabled.")

  callback()
  message.channel.sendMessage(`Successfully removed ${link} from this channel.`).then(m => message.channel.stopTyping())
  // message.channel.stopTyping()

}
