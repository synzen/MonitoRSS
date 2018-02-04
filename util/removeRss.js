const fileOps = require('../util/fileOps.js')
const dbCmds = require('../rss/db/commands.js')
const storage = require('./storage.js')
const currentGuilds = storage.currentGuilds
const deletedFeeds = storage.deletedFeeds

module.exports = function (guildId, rssName, callback) {
  const guildRss = currentGuilds.get(guildId)
  const rssList = guildRss.sources
  const link = rssList[rssName].link

  dbCmds.dropCollection(rssName, err => {
    delete rssList[rssName]
    fileOps.updateFile(guildId, guildRss)
    deletedFeeds.push(rssName)
    if (!err) console.log(`RSS Removal: (${guildId}, ${guildRss.name}) => Removed ${link}`)

    if (typeof callback === 'function') callback(err, link, rssName)
  })
}
