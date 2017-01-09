var rssConfig = require('../config.json')
var rssList = rssConfig.sources
const getRSS = require('../rss/rss.js')
const checkValidConfig = require('../util/configCheck.js')

module.exports = function (message, rssIndex, callback) {

  getRSS(rssIndex, message.channel, true);
  callback()

}
