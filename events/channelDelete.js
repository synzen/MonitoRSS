const removeRSS = require('../commands/rssremove.js')
const fileOps = require('../util/fileOps.js')
const channelTracker = require('../util/channelTracker.js')
const removeRss = require('../util/removeRss.js')

module.exports = function (channel) {
  var rssList = require(`../sources/${channel.guild.id}.json`).sources

  for (var channelId in channelTracker.activeCollectors) if (channelId === channel.id) delete channelTracker.activeCollectors[channelId];

  var nameList = []
  for (let rssName in rssList) {
    if (rssList[rssName].channel === channel.id || rssList[rssName].channel === channel.name) nameList.push(rssName);
  }
  if (nameList.length === 0) return;

  console.log(`Guild Info: (${channel.guild.id}, ${channel.guild.name}) => Channel (${channel.id}, ${channel.name}) deleted.`);

  for (var name in nameList) {
    removeRss(channel.guild.id, nameList[name]);
  }

}
