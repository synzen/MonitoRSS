var rssConfig = require('../config.json')
var rssList = rssConfig.sources
const getRSS = require('../rss/rss.js')
const checkValidConfig = require('../util/configCheck.js')
const sqlCmds = require('../rss/sql/commands.js')
const sqlConnect = require('../rss/sql/connect.js')

module.exports = function (commands, message, rssIndex) {

  var con = sqlConnect(getTestMsg);

  message.channel.startTyping();
  function getTestMsg() {
    getRSS(con, rssIndex, message.channel, true, function () {
      sqlCmds.end(con, function(err) {
        // console.log("RSS Info: Finished feed retrieval cycle.")
      });
    });
  }

}
