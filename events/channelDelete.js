const removeRSS = require('../commands/removeRSS.js')
var rssConfig = require('../config.json')
var guildList = rssConfig.sources

module.exports = function (channel) {

  let rssList = rssConfig.sources[channel.guild.id]
  for (let rssIndex in rssList) {
    if (rssList[rssIndex].channel == channel.id) {
      removeRSS(channel, rssIndex)
    }
  }

}
