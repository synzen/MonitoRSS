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
  message.channel.startTyping()
  request(content[1], (error, response, body) => {

    if (!error && response.statusCode == 200){

      for (var x in rssList) {
        if ( rssList[x].link == content[1] && isCurrentChannel(rssList[x].channel) ) {
          message.channel.stopTyping();
          return message.channel.sendMessage("This feed already exists for this channel.");
        }
      }
      //message.channel.startTyping();
      initializeRSS(bot, content[1], message.channel);
    }

    else {
      message.channel.stopTyping();
      return message.channel.sendMessage("That is an invalid feed link.");
    }

  });

}
