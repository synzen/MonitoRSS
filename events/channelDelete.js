const channelTracker = require('../util/channelTracker.js')
const removeRss = require('../util/removeRss.js')
const currentGuilds = require('../util/storage.js').currentGuilds

module.exports = function (channel) {
  const rssList = currentGuilds.get(channel.guild.id).sources

  for (var channelId in channelTracker.activeCollectors) if (channelId === channel.id) delete channelTracker.activeCollectors[channelId]

  let nameList = []
  for (var rssName in rssList) {
    if (rssList[rssName].channel === channel.id || rssList[rssName].channel === channel.name) nameList.push(rssName)
  }
  if (nameList.length === 0) return

  console.log(`Guild Info: (${channel.guild.id}, ${channel.guild.name}) => Channel (${channel.id}, ${channel.name}) deleted.`)

  for (var name in nameList) {
    removeRss(channel.guild.id, nameList[name])
  }
}
