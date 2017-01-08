const checkValidConfig = require('./configCheck.js')
const getRSS = require('../rss/rss.js')

module.exports = function (bot, feedIndex) {
  var rssConfig = require('../config.json')
  var rssList = rssConfig.sources

  function validChannel(rssIndex) {
    if (isNaN(parseInt(rssList[rssIndex].channel,10))) {
      let channel = bot.channels.find("name",rssList[rssIndex].channel);
      if (channel == null) {
        console.log(`RSS: ${rssList[rssIndex].name}'s string-defined channel was not found, skipping...`)
        return false;
      }
      else return channel;
    }
    else {
      let channel = bot.channels.get(`${rssList[rssIndex].channel}`);
      if (channel == null) {
        console.log(`RSS: ${rssList[rssIndex].name}'s integer-defined channel was not found. skipping...`)
        return false;
      }
      else return channel;
    }
  }

  function startFeed () {
    rssConfig = require('../config.json')
    rssList = rssConfig.sources
    for (var rssIndex in rssList)
      if (checkValidConfig(rssIndex, false))
        if (validChannel(rssIndex) !== false)
          getRSS(rssIndex , validChannel(rssIndex), false);
  }


  startFeed()
  setInterval(startFeed, rssConfig.refreshTimeMinutes*60000)

}
