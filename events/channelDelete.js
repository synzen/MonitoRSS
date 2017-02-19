const removeRSS = require('../commands/rssRemove.js')
const fileOps = require('../util/updateJSON.js')

module.exports = function (channel) {
  var rssList = require(`../sources/${channel.guild.id}.json`).sources

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
