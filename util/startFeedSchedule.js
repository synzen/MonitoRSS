const checkValidConfig = require('./configCheck.js')
const getRSS = require('../rss/rss.js')

module.exports = function (bot, feedIndex) {
  var rssConfig = require('../config.json')
  var guildList = rssConfig.sources

  function validChannel(guildIndex, rssIndex) {
    if (isNaN(parseInt(guildList[guildIndex][rssIndex].channel,10))) {
      let channel = bot.channels.find("name",guildList[guildIndex][rssIndex].channel);
      if (channel == null) {
        console.log(`RSS Warning: ${guildList[guildIndex][rssIndex].name}'s string-defined channel was not found, skipping...`)
        return false;
      }
      else return channel;
    }
    else {
      let channel = bot.channels.get(`${guildList[guildIndex][rssIndex].channel}`);
      if (channel == null) {
        console.log(`RSS Warning: ${guildList[guildIndex][rssIndex].name}'s integer-defined channel was not found. skipping...`)
        return false;
      }
      else return channel;
    }
  }

  function startFeed () {
    rssConfig = require('../config.json')
    rssList = rssConfig.sources
    for (var guildIndex in guildList)
      for (var rssIndex in guildList[guildIndex])
        if (checkValidConfig(guildIndex, rssIndex, false))
          if (validChannel(guildIndex, rssIndex) !== false)
            getRSS(rssIndex , validChannel(guildIndex, rssIndex), false);
  }


  startFeed()
  setInterval(startFeed, rssConfig.refreshTimeMinutes*60000)

}
