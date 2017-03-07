const getRSS = require('../rss/rss.js')
const getIndex = require('./util/printFeeds.js')
const checkValidConfig = require('../util/configCheck.js')
const sqlCmds = require('../rss/sql/commands.js')
const sqlConnect = require('../rss/sql/connect.js')

module.exports = function(bot, message, command) {

  getIndex(bot, message, command, function(rssName) {
    message.channel.sendMessage(`Grabbing a random feed article...`)
    .then(grabMsg => {
      // Replicate the RSS process for a test article
      var con = sqlConnect(getTestMsg)
      function getTestMsg() {
        getRSS(con, message.channel, rssName, grabMsg, function (err) {
          if (err) channel.sendMessage('Unable to get test feed either because of connection error or invalid feed.');
          sqlCmds.end(con, function(err) {
            if (err) throw err;
          })
        });
      }
    })
    .catch(err => console.log(`Promise Warning: rssTest 1: ${err}`))
  })
  
}
