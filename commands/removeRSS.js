const fileOps = require('../util/updateJSON.js')
const sqlCmds = require('../rss/sql/commands.js')
const rssConfig = require('../config.json')

module.exports = function (message, rssIndex) {
  var guildRss = require(`../sources/${message.guild.id}.json`)
  var rssList = guildRss.sources

  if (message.channel != null) message.channel.startTyping();

  let link = rssList[rssIndex].link
  console.log(`RSS Removal: (${message.guild.id}, ${message.guild.name}) => Starting removal of ${link}`)
  sqlCmds.dropTable(rssConfig.databaseName, rssList[rssIndex].name, function () {
    console.log(`RSS Removal: (${message.guild.id}, ${message.guild.name}) => Removal successful.`)
  })
  rssList.splice(rssIndex,1)
  fileOps.updateFile(`./sources/${message.guild.id}.json`, guildRss, `../sources/${message.guild.id}.json`)

  if (rssList.length == 0 && guildRss.timezone == null) fileOps.deleteFile(`./sources/${message.guild.id}.json`, `../sources/${message.guild.id}.json`, function () {
    return console.log(`RSS File Ops: Deleted ${message.guild.id}.json due to zero sources detected..`)
  });

  var enabledFeeds = 0;

  for (var x in rssList) {
    if (rssList[x].enabled == 1) enabledFeeds++;
  }

  if (message.channel != null) {
    message.channel.sendMessage(`Successfully removed ${link} from this channel.`);
    message.channel.stopTyping();
  }

}
