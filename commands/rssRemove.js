const fileOps = require('../util/updateJSON.js')
const sqlCmds = require('../rss/sql/commands.js')
const config = require('../config.json')

module.exports = function (message, rssIndex, callback) {
  var guildRss = require(`../sources/${message.guild.id}.json`)
  var rssList = guildRss.sources

  if (rssList[rssIndex] == null) return console.log(`RSS Error: (${message.guild.id}, ${message.guild.name}) => Could not remove feed due to null rssList.`);

  var link = rssList[rssIndex].link

  //must be checked because this is called when chanels are deleted as well
  if (message.channel) var msg = message.channel.sendMessage(`Removing ${link}...`);

  console.log(`RSS Removal: (${message.guild.id}, ${message.guild.name}) => Starting removal of ${link}`)
  sqlCmds.dropTable(config.feedManagement.databaseName, rssList[rssIndex].name, function () {
    console.log(`RSS Removal: (${message.guild.id}, ${message.guild.name}) => Removal successful.`)
  })
  rssList.splice(rssIndex,1)
  fileOps.updateFile(message.guild.id, guildRss, `../sources/${message.guild.id}.json`)

  // if (rssList.length == 0 && !guildRss.timezone) fileOps.deleteFile(message.guild.id, `../sources/${message.guild.id}.json`, function () {
  //   return console.log(`RSS File Ops: Attempted to remove profile ${message.guild.id}.json due to zero sources detected.`)
  // });

  if (typeof callback === 'function') callback();

  if (message.channel) msg.then(m => m.edit(`Successfully removed ${link} from this channel.`));

}
