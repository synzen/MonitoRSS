const channelTracker = require('../util/channelTracker.js')
const currentGuilds = require('../util/storage.js').currentGuilds
const log = require('../util/logger.js')
const dbOps = require('../util/dbOps.js')

module.exports = channel => {
  const guildRss = currentGuilds.get(channel.guild.id)
  if (!guildRss) return
  const rssList = guildRss.sources

  for (var channelId in channelTracker.activeCollectors) if (channelId === channel.id) delete channelTracker.activeCollectors[channelId]

  let nameList = []
  for (var rssName in rssList) {
    if (rssList[rssName].channel === channel.id) nameList.push(rssName)
  }
  if (nameList.length === 0) return

  log.guild.info(`Channel deleted`, channel.guild, channel)

  for (var name in nameList) {
    dbOps.guildRss.removeFeed(guildRss, nameList[name], (err, link) => {
      if (err) return log.guild.warning(`Unable to remove feed ${link} triggered by channel deletion`, channel.guild, err)
      log.guild.info(`Removed feed ${link}`, channel.guild)
    })
  }
}
