var rssConfig = require('../config.json')
var rssList = rssConfig.sources
const request = require('request')
const initializeRSS = require('../rss/initialize.js')

module.exports = function (bot, message) {

  function isCurrentChannel(channel) {
    if (isNaN(parseInt(channel,10))) {
      if (message.channel.name == channel) return true;
      else return false;
    }
    else {
      if (message.channel.id == channel) return true;
      else return false;
    }
  }

  let content = message.content.split(" ");

  if (content.length == 1) return;

  request(content[1], (error, response, body) => {

    if (!error && response.statusCode == 200){
      for (var x in rssList) {
        if ( rssList[x].link == content[1] && isCurrentChannel(rssList[x].channel) ) {
          let msg = "This RSS feed already exists for this channel."
          if (rssList[x].enabled == 0) msg += " It has been disabled in the config.";
          return message.channel.sendMessage(msg);
        }
      }
      initializeRSS(bot, content[1], message.channel);
    }

    else return message.channel.sendMessage("Invalid link.");

  });

}
