const fileOps = require('../util/fileOps.js')
const sqlCmds = require('../rss/sql/commands.js')
const config = require('../config.json')

module.exports = function (guildId, rssName, callback) {
  var guildRss = require(`../sources/${guildId}.json`)
  var rssList = guildRss.sources

  console.log(`RSS Removal: (${guildId}, ${guildRss.name}) => Starting removal of ${rssList[rssName].link}`)
  sqlCmds.dropTable(config.feedManagement.databaseName, rssName, function () {
    console.log(`RSS Removal: (${guildId}, ${guildRss.name}) => Removal successful.`)
  })
  delete rssList[rssName];
  fileOps.updateFile(guildId, guildRss, `../sources/${guildId}.json`)

  if (typeof callback === 'function') callback();
}
