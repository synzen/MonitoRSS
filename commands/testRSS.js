var rssConfig = require('../config.json')
var rssList = rssConfig.sources
const getRSS = require('../rss/rss.js')
const checkValidConfig = require('../util/configCheck.js')

module.exports = function (commands, message, rssIndex) {
  message.channel.startTyping();
  getRSS(rssIndex, message.channel, true);

}
