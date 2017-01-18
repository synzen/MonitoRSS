const fileOps = require('../util/updateJSON.js')
const sqlCmds = require('../rss/sql/commands.js')
const rssConfig = require('../config.json')

module.exports = function (message, rssIndex) {
  var guildRss = require(`../sources/${message.guild.id}.json`)
  var rssList = guildRss.sources

  if (message.channel != null) message.channel.startTyping();

  let link = rssList[rssIndex].link
  console.log(`RSS Info: (${guild.id}, ${guild.name}) => Starting removal of ${rssList[rssIndex].name}`)
  sqlCmds.dropTable(rssConfig.databaseName, rssList[rssIndex].name)
  rssList.splice(rssIndex,1)
  fileOps.updateFile(`./sources/${message.guild.id}.json`, guildRss, `../sources/${message.guild.id}.json`)

  if (rssList.length == 0) fileOps.deleteFile(`./sources/${message.guild.id}.json`);

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
