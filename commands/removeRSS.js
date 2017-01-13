
const updateConfig = require('../util/updateJSON.js')
const sqlCmds = require('../rss/sql/commands.js')

module.exports = function (message, rssIndex) {
  var rssConfig = require('../config.json')
  var rssList = rssConfig.sources[message.guild.id]

  if (message.channel != null) message.channel.startTyping();

  let link = rssList[rssIndex].link
  sqlCmds.dropTable(rssConfig.databaseName, rssList[rssIndex].name)
  rssList.splice(rssIndex,1)
  if (rssList.length == 0) delete rssConfig.sources[message.guild.id];
  updateConfig('./config.json', rssConfig)

  var enabledFeeds = 0;

  for (var x in rssList) {
    if (rssList[x].enabled == 1) enabledFeeds++;
  }

  if (enabledFeeds == 0 || rssList == null) console.log(`RSS Info: No more active feeds enabled for guild ${message.guild.id} (${message.guild.name}).`)

  if (message.channel != null) {
    message.channel.sendMessage(`Successfully removed ${link} from this channel.`);
    message.channel.stopTyping();
  }

}
