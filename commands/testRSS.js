var rssConfig = require('../config.json')
var rssList = rssConfig.sources
const getRSS = require('../rss/rss.js')
const checkValidConfig = require('../util/configCheck.js')

module.exports = function (bot, message) {

  function isCurrentChannel(channel) {
    if (isNaN(parseInt(channel,10))) {
      let currentChannel = message.channel.name;
      if (currentChannel == channel) return true;
      else return false;
    }
    else {
      let currentChannel = message.channel.id;
      if (currentChannel == channel) return true;
      else return false;
    }
  }

  var currentRSSList = [];
  for (var rssIndex in rssList){
    if (checkValidConfig(rssIndex, false, false)) {
      if ( isCurrentChannel(rssList[rssIndex].channel) )
        currentRSSList.push( [rssList[rssIndex].link, rssIndex] );
    }
  }

  if (currentRSSList.length > 0){
    for (var index in currentRSSList){
      getRSS(currentRSSList[index][1], message.channel, true);
    }
  }
  else return message.channel.sendMessage("No RSS assigned to this channel.");

}
