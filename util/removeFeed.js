const fileOps = require('../util/fileOps.js')
const dbCmds = require('../rss/db/commands.js')
const storage = require('./storage.js')
const linkList = storage.linkList
const currentGuilds = storage.currentGuilds
const deletedFeeds = storage.deletedFeeds

module.exports = (guildId, rssName, callback) => {
  const guildRss = currentGuilds.get(guildId)
  const rssList = guildRss.sources
  const link = rssList[rssName].link
  const index = linkList.indexOf(link)
  if (index > -1) linkList.splice(index, 1)

  dbCmds.dropCollection(rssName, err => {
    delete rssList[rssName]
    fileOps.updateFile(guildId, guildRss)
    deletedFeeds.push(rssName)
    if (!err) console.log(`RSS Removal: (${guildId}, ${guildRss.name}) => Removed ${link}`)

    if (typeof callback === 'function') callback(err, link, rssName)
  })
}
