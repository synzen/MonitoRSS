const dbOps = require('../util/dbOps.js')
const storage = require('./storage.js')
const currentGuilds = storage.currentGuilds
const deletedFeeds = storage.deletedFeeds
const log = require('../util/logger.js')

module.exports = (guildId, rssName, callback) => {
  const guildRss = currentGuilds.get(guildId)
  const rssList = guildRss.sources
  const link = rssList[rssName].link

  dbOps.linkList.decrement(link, err => {
    if (err) log.general.warning(`Unable to decrement linkList for ${link} for removeFeed`, err)
    delete rssList[rssName]
    dbOps.guildRss.update(guildRss)
    deletedFeeds.push(rssName)
    dbOps.guildRss.empty(guildRss)
    if (typeof callback === 'function') callback(err, link, rssName)
  })
}
