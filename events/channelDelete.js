const removeRSS = require('../commands/rssremove.js')
const fileOps = require('../util/fileOps.js')
const channelTracker = require('../util/channelTracker.js')

module.exports = function (channel) {
  var rssList = require(`../sources/${channel.guild.id}.json`).sources

  for (var channelId in channelTracker.activeCollectors) if (channelId === channel.id) delete channelTracker.activeCollectors[channelId];

  var indexList = []
  for (let rssIndex in rssList) {
    if (rssList[rssIndex].channel === channel.id) indexList.push(rssIndex);
  }
  if (indexList.length === 0) return;

  console.log(`Guild Info: (${channel.guild.id}, ${channel.guild.name}) => Channel (${channel.id}, ${channel.name}) deleted.`);

  (function removeFeedIndexes () {
    removeRSS(channel, indexList[indexList.length - 1], function () {
      indexList.splice(indexList.length - 1, 1)
      if (indexList.length !== 0) removeFeedIndexes();
    });
  })()


}
