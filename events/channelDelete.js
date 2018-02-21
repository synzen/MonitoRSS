const channelTracker = require('../util/channelTracker.js')
const removeRss = require('../util/removeFeed.js')
const currentGuilds = require('../util/storage.js').currentGuilds

module.exports = function (channel) {
  const guildRss = currentGuilds.get(channel.guild.id)
  if (!guildRss) return
  const rssList = guildRss.sources

  for (var channelId in channelTracker.activeCollectors) if (channelId === channel.id) delete channelTracker.activeCollectors[channelId]

  let nameList = []
  for (var rssName in rssList) {
    if (rssList[rssName].channel === channel.id) nameList.push(rssName)
  }
  if (nameList.length === 0) return

  console.log(`Guild Info: (${channel.guild.id}, ${channel.guild.name}) => Channel (${channel.id}, ${channel.name}) deleted.`)

  for (var name in nameList) {
    removeRss(channel.guild.id, nameList[name], err => {
      if (err) console.log(`Guild Warning: channelDelete error`, err.message || err)
    })
  }
}
