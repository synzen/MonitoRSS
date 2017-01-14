const removeRSS = require('../commands/removeRSS.js')
const fs = require('fs')

module.exports = function (channel) {
  if (!fs.existsSync(`./sources/${channel.guild.id}.json`)) return;
  else var rssList = require(`../sources/${channel.guild.id}.json`).sources;

  for (let rssIndex in rssList) {
    if (rssList[rssIndex].channel == channel.id) {
      removeRSS(channel, rssIndex);
    }
  }

}
