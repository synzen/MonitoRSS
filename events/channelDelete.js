const removeRSS = require('../commands/rssRemove.js')

module.exports = function (channel) {
  var rssList = require(`../sources/${channel.guild.id}.json`).sources

  console.log(`Guild Info: (${channel.guild.id}, ${channel.guild.name}) => Channel (${channel.id}, ${channel.name}) deleted.`)

  for (let rssIndex in rssList) {
    if (rssList[rssIndex].channel == channel.id) removeRSS(channel, rssIndex);
  }

}
