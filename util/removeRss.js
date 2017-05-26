const fs = require('fs')
const fileOps = require('../util/fileOps.js')
const sqlCmds = require('../rss/sql/commands.js')
const config = require('../config.json')
const storage = require('./storage.js')
const currentGuilds = storage.currentGuilds
const failedLinks = storage.failedLinks
const deletedFeeds = storage.deletedFeeds

module.exports = function (guildId, rssName, callback) {
  const guildRss = currentGuilds.get(guildId)
  const rssList = guildRss.sources
  const link = rssList[rssName].link

  if (failedLinks[rssList[rssName].link]) {
    delete failedLinks[rssList[rssName].link]
    try { fs.writeFileSync('./settings/failedLinks.json', JSON.stringify(failedLinks, null, 2)) } catch (e) { console.log(`Error: Unable to update failedLinks.json from removeRss. Reason: ${e}`) }
  }

  sqlCmds.dropTable(config.feedManagement.databaseName, rssName)
  delete rssList[rssName]
  fileOps.updateFile(guildId, guildRss)
  deletedFeeds.push(rssName)

  console.log(`RSS Removal: (${guildId}, ${guildRss.name}) => Removed ${link}`)

  if (typeof callback === 'function') callback(link, rssName)
}
